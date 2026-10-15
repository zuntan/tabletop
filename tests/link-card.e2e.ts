import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { chromium } from 'playwright';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('card open controls launch a separate tab without selecting, moving or placing objects', { timeout: 45_000 }, async () => {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = (server.address() as { port: number }).port;
  await new Promise<void>(resolve => server.close(() => resolve()));
  const token = 'link-card-test-01234567890123456789';
  const transport = new StdioClientTransport({ command: process.execPath, args: ['--import', 'tsx', 'src/server.ts'], cwd: process.cwd(),
    env: { ...Object.fromEntries(Object.entries(process.env).filter((pair): pair is [string, string] => pair[1] !== undefined)), TABLETOP_PORT: String(port), TABLETOP_TOKEN: token }, stderr: 'pipe' });
  const client = new Client({ name: 'link-card-test', version: '1.0.0' });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.TABLETOP_CHROME ?? '/usr/bin/google-chrome' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  async function call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    assert.notEqual(result.isError, true, JSON.stringify(result));
    return JSON.parse((result.content as { text: string }[])[0].text);
  }
  const destination = `http://127.0.0.1:${port}/missing-page?opened=1`;
  try {
    await client.connect(transport); await call('desk_pairing_open', { confirm: true }); await page.goto(`http://127.0.0.1:${port}/#token=${token}&port=${port}`);
    await page.waitForFunction(() => document.querySelector('#connection')?.textContent === 'MCP接続済み');
    await call('desk_execute', { operations: [
      { kind: 'add', object: { id: 'card', type: 'link', x: 250, y: 160, width: 320, height: 60, text: '資料', url: destination } },
      { kind: 'add', object: { id: 'web-card', type: 'web', x: 250, y: 320, width: 320, height: 160, text: 'Web資料', url: destination } },
    ] });
    const open = page.locator('[data-open-url="card"]');
    assert.equal(await open.getAttribute('target'), '_blank');
    assert.equal(await open.getAttribute('rel'), 'noopener noreferrer');
    assert.equal(await open.getAttribute('aria-label'), '別タブで開く：資料');
    await page.locator('#numbering').click();
    const state = await call('desk_state'); const originalUrl = page.url();
    const [popup] = await Promise.all([page.waitForEvent('popup'), open.click()]);
    await popup.waitForURL(destination);
    assert.equal(await popup.evaluate(() => window.opener === null), true);
    assert.equal(page.url(), originalUrl);
    assert.deepEqual(await call('desk_state'), state);
    assert.equal(await page.locator('[data-inline-text]').count(), 0);
    await popup.close();
    await page.locator('#selection-mode').click();
    const body = page.locator('[data-id="card"] > rect');
    const box = (await body.boundingBox())!;
    await page.mouse.move(box.x + 30, box.y + 30); await page.mouse.down();
    await page.mouse.move(box.x + 78, box.y + 54, { steps: 4 }); await page.mouse.up();
    assert.deepEqual((await call('desk_selection')).ids, ['card']);
    const moved = await call('desk_get', { id: 'card' });
    assert.equal(moved.x, 298); assert.equal(moved.y, 184);
    await body.dblclick();
    const input = page.locator('[data-inline-text]'); await input.fill('編集済み'); await input.press('Enter');
    assert.equal((await call('desk_get', { id: 'card' })).text, '編集済み');
    assert.equal(await open.getAttribute('aria-label'), '別タブで開く：編集済み');
    const beforeKeyboard = await call('desk_state');
    await open.focus();
    const [keyboardPopup] = await Promise.all([page.waitForEvent('popup'), open.press('Enter')]);
    await keyboardPopup.waitForURL(destination); await keyboardPopup.close();
    assert.deepEqual(await call('desk_state'), beforeKeyboard);
    const [webPopup] = await Promise.all([page.waitForEvent('popup'), page.locator('[data-open-url="web-card"]').click()]);
    await webPopup.waitForURL(destination); await webPopup.close();
    assert.equal((await call('desk_summary')).count, 2);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await client.close(); await transport.close(); }
});
