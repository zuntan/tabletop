import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { chromium } from 'playwright';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export async function openTestDesk(name: string, initScript?: string, serverPrelude?: string) {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = (server.address() as { port: number }).port;
  await new Promise<void>(resolve => server.close(() => resolve()));
  const token = `${name}-012345678901234567890123456789`;
  const args = serverPrelude ? ['--import', 'tsx', '--input-type=module', '--eval', `${serverPrelude}; await import('./src/server.ts');`] : ['--import', 'tsx', 'src/server.ts'];
  const transport = new StdioClientTransport({ command: process.execPath, args, cwd: process.cwd(),
    env: { ...Object.fromEntries(Object.entries(process.env).filter((pair): pair is [string, string] => pair[1] !== undefined)), TABLETOP_PORT: String(port), TABLETOP_TOKEN: token }, stderr: 'pipe' });
  const client = new Client({ name, version: '1.0.0' });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.TABLETOP_CHROME ?? '/usr/bin/google-chrome' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  async function close() { await browser.close(); await client.close(); await transport.close(); }
  let toolSchemas:Awaited<ReturnType<Client['listTools']>>['tools']|undefined;
  async function call(name: string, args: Record<string, unknown> = {}) {
    // Non-grid tests use exact fixtures; grid tests explicitly exercise the public default via client.callTool.
    toolSchemas??=(await client.listTools()).tools;
    const schema=toolSchemas.find(tool=>tool.name===name)?.inputSchema;
    const target=schema?.required?.includes('deskId')?{deskId:await page.locator('#desk-id').textContent()}:{};
    const result = await client.callTool({ name, arguments: ['desk_execute', 'desk_asset_import'].includes(name) ? { ...target,snap: 'exact', ...args } : {...target,...args} });
    assert.notEqual(result.isError, true, JSON.stringify(result));
    return JSON.parse((result.content as { text: string }[])[0].text);
  }
  try {
    await client.connect(transport);
    await call('desk_pairing_open', { confirm: true });
    if (initScript) await page.addInitScript(initScript);
    await page.goto(`http://127.0.0.1:${port}/#token=${token}&port=${port}`);
    await page.waitForFunction(() => document.querySelector('#connection')?.textContent === 'MCP接続済み');
    return { page, client, call, close, port, errors };
  } catch (error) { await close(); throw error; }
}
