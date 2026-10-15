import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { chromium } from 'playwright';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Characterization tests: no live port, user configuration, or existing desk is touched.
for (const fixed of [false, true]) {
  test(`server restart ${fixed ? 'with a fixed token recovers' : 'with a generated token needs new credentials'} without losing browser objects`, { timeout: 25_000 }, async () => {
    const listener = createServer(); listener.listen(0, '127.0.0.1'); await once(listener, 'listening');
    const port = (listener.address() as { port: number }).port;
    await new Promise<void>(resolve => listener.close(() => resolve()));
    const fixedToken = 'isolated-recovery-fixed-01234567890123456789';
    const env = Object.fromEntries(Object.entries(process.env).filter((pair): pair is [string, string] => pair[1] !== undefined));
    delete env.TABLETOP_TOKEN;
    env.TABLETOP_PORT = String(port);
    if (fixed) env.TABLETOP_TOKEN = fixedToken;
    const browser = await chromium.launch({ headless: true, executablePath: process.env.TABLETOP_CHROME ?? '/usr/bin/google-chrome' });
    const page = await browser.newPage();
    let current: { client: Client; transport: StdioClientTransport } | undefined;
    async function start() {
      const transport = new StdioClientTransport({ command: process.execPath, args: ['--import', 'tsx', 'src/server.ts'], cwd: process.cwd(), env, stderr: 'pipe' });
      const client = new Client({ name: 'connection-investigation', version: '1.0.0' });
      current = { client, transport };
      await client.connect(transport);
    }
    async function stop() {
      const previous = current; current = undefined;
      if (previous) { await previous.client.close(); await previous.transport.close(); }
    }
    async function call(name: string, args: Record<string, unknown> = {}) {
      const result = await current!.client.callTool({ name, arguments: args });
      assert.notEqual(result.isError, true, JSON.stringify(result));
      return JSON.parse((result.content as { text: string }[])[0].text);
    }
    async function credentials() {
      const info = await call('desk_connection_info');
      return fixed ? fixedToken : new URLSearchParams(new URL(info.url).hash.slice(1)).get('token')!;
    }
    try {
      await start();
      const firstToken = await credentials();
      await page.goto(`http://127.0.0.1:${port}/#token=${firstToken}&port=${port}`);
      await page.waitForFunction(() => document.querySelector('#connection')?.textContent === 'MCP接続済み');
      await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'retained', type: 'rect', text: 'keep me' } }] });
      const before = await call('desk_summary');
      // A normal close reaches the browser, but the separate footer keeps the old success text.
      await stop();
      await page.waitForFunction(() => document.querySelector('#connection')?.textContent === '未接続 · 再接続待ち');
      assert.equal(await page.locator('#message').textContent(), 'AIと共有できる状態です');
      await start();
      const nextToken = await credentials();
      assert.equal(firstToken === nextToken, fixed);
      if (!fixed) {
        await page.waitForFunction(() => document.querySelector('#message')?.classList.contains('error'), undefined, { timeout: 10_000 });
        assert.equal((await call('desk_connection_info')).browserConnected, false);
        assert.equal(await page.locator('#count').textContent(), '1');
        // Re-enter credentials without a reload: the same browser-owned desk reconnects.
        await page.getByRole('tab', { name: '接続', exact: true }).click();
        await page.locator('#token').fill(nextToken);
        await page.locator('#connect-form button').click();
      }
      await page.waitForFunction(() => document.querySelector('#connection')?.textContent === 'MCP接続済み', undefined, { timeout: 10_000 });
      const after = await call('desk_summary');
      assert.equal(after.sessionId, before.sessionId);
      assert.equal(after.revision, before.revision);
      assert.equal(after.count, 1);
      assert.equal((await call('desk_get', { id: 'retained' })).text, 'keep me');
      assert.equal(await page.locator('#message').evaluate(element => element.classList.contains('error')), false);
    } finally { await browser.close(); await stop(); }
  });
}
