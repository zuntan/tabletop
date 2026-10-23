import { respondToConfirm } from './confirm-response';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { chromium } from 'playwright';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Restart regression tests: no live port, user configuration, or existing desk is touched.
for (const fixed of [false, true]) {
  test(`server restart recovers only the restored pair (${fixed ? 'fixed' : 'generated'} bootstrap token) without losing browser objects`, { timeout: 25_000 }, async () => {
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
    let sockets = 0; page.on('websocket', () => { sockets++; });
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
      await call('desk_pairing_open', { confirm: true });
      await page.goto(`http://127.0.0.1:${port}/#token=${firstToken}&port=${port}`);
      await page.waitForFunction(() => document.querySelector('#connection')?.textContent === 'MCP接続済み');
      await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'retained', type: 'rect', text: 'keep me' } }] });
      const before = await call('desk_summary');
      const { pairing } = await call('desk_pairing_info');
      assert.ok(pairing?.secret);
      await call('desk_point', { ids: ['retained'] });
      await stop();
      await page.waitForFunction(() => document.querySelector('#connection')?.textContent === 'AI再接続待ち');
      assert.notEqual(await page.locator('#message').textContent(), 'AIと共有できる状態です');
      assert.equal(await page.locator('[data-ai-point]').count(), 0);
      await page.locator('[data-add="rect"]').click(); // Human editing while disconnected.
      await page.getByRole('dialog',{name:'図形の候補',exact:true}).getByRole('button',{name:'矩形',exact:true}).click();
      assert.equal(await page.locator('#message').evaluate(element => element.classList.contains('error')), false);
      await start();
      const nextToken = await credentials();
      assert.equal(firstToken === nextToken, fixed);
      if (!fixed) {
        await page.waitForTimeout(1200); // Recovery must remain quiet before the AI arms it.
        assert.equal((await call('desk_connection_info')).browserConnected, false);
        assert.equal(await page.locator('#count').textContent(), '2');
        assert.equal(await page.locator('#message').evaluate(element => element.classList.contains('error')), false);
      }
      assert.equal((await call('desk_pairing_info')).pairing, null);
      await call('desk_pairing_restore', { pairing });
      await page.waitForFunction(() => document.querySelector('#connection')?.textContent === 'MCP接続済み', undefined, { timeout: 10_000 });
      const after = await call('desk_summary');
      assert.equal(after.sessionId, before.sessionId);
      assert.equal(after.revision, before.revision + 1);
      assert.equal(after.count, 2);
      assert.equal((await call('desk_get', { id: 'retained' })).text, 'keep me');
      assert.ok(!JSON.stringify(await call('desk_state')).includes(pairing.secret));
      // Pair mismatch or a wrong server proof stops recovery; manual replacement keeps the document.
      await stop(); await start();
      const wrongPairing = fixed ? { ...pairing, pairId: crypto.randomUUID() } : { ...pairing, secret: '0'.repeat(64) };
      await call('desk_pairing_restore', { pairing: wrongPairing });
      await page.waitForFunction(() => document.querySelector('#connection')?.textContent === '接続確認が必要', undefined, { timeout: 10_000 });
      assert.equal((await call('desk_connection_info')).browserConnected, false);
      assert.equal(await page.locator('#message').evaluate(element => element.classList.contains('error')), true);
      const blockedSockets = sockets;
      await page.waitForTimeout(1500);
      assert.equal(sockets, blockedSockets);
      await call('desk_pairing_open', { confirm: true });
      await page.getByRole('tab', { name: '接続', exact: true }).click();
      await page.locator('#connection-url').fill(`http://127.0.0.1:${port}/#token=${encodeURIComponent(await credentials())}&port=${port}`);
      const confirmation1 = respondToConfirm(page, 'proceed');
      await page.locator('#connect-form button[type="submit"]').click();
      await confirmation1;
      await page.waitForFunction(() => document.querySelector('#connection')?.textContent === 'MCP接続済み', undefined, { timeout: 10_000 });
      assert.equal((await call('desk_summary')).sessionId, before.sessionId);
      assert.equal((await call('desk_summary')).count, 2);
      assert.notEqual((await call('desk_pairing_info')).pairing.pairId, pairing.pairId);
      assert.equal(await page.locator('#message').evaluate(element => element.classList.contains('error')), false);
    } finally { await browser.close(); await stop(); }
  });
}
