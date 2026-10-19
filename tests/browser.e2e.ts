import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { chromium } from 'playwright';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function freePort() {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = (server.address() as { port: number }).port;
  await new Promise<void>(resolve => server.close(() => resolve())); return port;
}
test('browser UI and real stdio agent share objects, gestures, selection and history', { timeout: 30_000 }, async () => {
  const port = await freePort(), token = 'browser-test-token-0123456789012345';
  const transport = new StdioClientTransport({
    command: process.execPath, args: ['--import', 'tsx', 'src/server.ts'], cwd: process.cwd(),
    env: { ...Object.fromEntries(Object.entries(process.env).filter((pair): pair is [string, string] => pair[1] !== undefined)), TABLETOP_PORT: String(port), TABLETOP_TOKEN: token }, stderr: 'pipe',
  });
  const client = new Client({ name: 'browser-test', version: '1.0.0' });
  const executablePath = process.env.TABLETOP_CHROME ?? (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
  const browser = await chromium.launch({ headless: true, executablePath });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  async function call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    assert.notEqual(result.isError, true, JSON.stringify(result));
    return JSON.parse((result.content as { text: string }[])[0].text);
  }
  try {
    await client.connect(transport);
    await call('desk_pairing_open', { confirm: true });
    await page.goto(`http://127.0.0.1:${port}/#token=${token}&port=${port}`);
    await page.waitForFunction(() => document.querySelector('#connection')?.textContent === 'MCP接続済み');
    assert.equal(new URL(page.url()).hash, '');
    await page.locator('#grid-snap').click(); // This gesture test intentionally uses unrestricted coordinates.
    await page.getByRole('button', { name: '矩形', exact: true }).click();
    const state = await call('desk_list'); assert.equal(state.count, 1);
    const id = state.objects[0].id;
    assert.deepEqual((await call('desk_selection')).ids, [id]);
    const shape = page.locator('#objects > g').first();
    const bounds = (await shape.boundingBox())!;
    await page.mouse.move(bounds.x + 30, bounds.y + 30); await page.mouse.down();
    await page.mouse.move(bounds.x + 110, bounds.y + 70, { steps: 5 });
    const busy = await client.callTool({ name: 'desk_summary' });
    assert.equal(busy.isError, true);
    await page.mouse.up();
    const moved = await call('desk_get', { id });
    assert.equal(moved.x, state.objects[0].x + 80); assert.equal(moved.y, state.objects[0].y + 40);
    assert.equal((await call('desk_summary')).revision, state.revision + 1);
    const handle = page.locator('[data-resize]'); const hb = (await handle.boundingBox())!;
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2 + 40, hb.y + hb.height / 2 + 30, { steps: 3 }); await page.mouse.up();
    assert.equal((await call('desk_get', { id })).width, moved.width + 40);
    await call('desk_execute', { actor: 'agent-01', operations: [{ kind: 'update', id, patch: { fill: '#ff0000' } }] });
    await page.waitForFunction(() => document.querySelector('#objects rect')?.getAttribute('fill') === '#ff0000');
    await page.getByRole('button', { name: '元に戻す', exact: true }).click();
    assert.equal((await call('desk_get', { id })).fill, '#dbeafe');
    await page.getByRole('button', { name: 'やり直す', exact: true }).click();
    assert.equal((await call('desk_get', { id })).fill, '#ff0000');
    const changes = await call('desk_changes', { sinceRevision: state.revision + 2 });
    assert.deepEqual(changes.changes.map((c: { operation: string }) => c.operation), ['batch', 'undo', 'redo']);
    assert.deepEqual(changes.changes.map((c: { actor: string }) => c.actor), ['agent-01', 'human', 'human']);
    const markup = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60"><script>window.svgExecuted=true</script><rect width="100" height="60" fill="green"/></svg>';
    await page.locator('#file').setInputFiles({ name: 'sample.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(markup) });
    await page.waitForFunction(() => document.querySelector('#count')?.textContent === '2');
    assert.equal((await call('desk_list')).objects[1].type, 'svg');
    assert.equal(await page.evaluate(() => (window as unknown as { svgExecuted?: boolean }).svgExecuted), undefined);
    await call('desk_execute', { operations: [
      { kind: 'add', object: { id: 'text-ai', type: 'text', text: '<script>alert(1)</script>', x: 400, y: 200 } },
      { kind: 'add', object: { id: 'ellipse-ai', type: 'ellipse', x: 600, y: 300 } },
      { kind: 'add', object: { id: 'line-ai', type: 'line', x: 400, y: 400 } },
      { kind: 'add', object: { id: 'arrow-ai', type: 'arrow', x: 600, y: 500 } },
      { kind: 'add', object: { id: 'link-ai', type: 'link', url: 'https://example.com', x: 600, y: 100 } },
    ] });
    assert.equal(await page.locator('#objects script').count(), 0);
    assert.equal(await page.locator('#objects > g').count(), 7);
    await call('desk_select', { ids: [id, 'text-ai'] });
    await page.waitForFunction(() => document.querySelector('#selected-label')?.textContent?.startsWith('2 個選択'));
    await page.locator('#canvas').focus(); await page.keyboard.press('Delete');
    assert.equal((await call('desk_summary')).count, 5);
    await page.keyboard.press('Control+z'); assert.equal((await call('desk_summary')).count, 7);
    const png = await page.locator('#canvas').screenshot();
    await page.locator('#file').setInputFiles({ name: 'capture.png', mimeType: 'image/png', buffer: png });
    await page.waitForFunction(() => document.querySelector('#count')?.textContent === '8');
    assert.equal((await call('desk_list')).objects[7].type, 'image');
    await call('desk_execute', { operations: [{ kind: 'add', object: {
      id: 'web-ai', type: 'web', url: `http://127.0.0.1:${port}/missing-page`, width: 320, height: 240,
    } }] });
    await call('desk_select', { ids: ['web-ai'] });
    assert.equal(await page.locator('iframe').getAttribute('sandbox'), 'allow-scripts');
    assert.equal(await page.locator('#open-url').getAttribute('href'), `http://127.0.0.1:${port}/missing-page`);
    await call('desk_select', { ids: [id] });
    await page.locator('#properties input[name="x"]').fill('123');
    await page.locator('#properties input[name="x"]').press('Enter');
    assert.equal((await call('desk_get', { id })).x, 123);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await client.close(); await transport.close(); }
});
