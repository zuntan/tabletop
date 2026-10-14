import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { chromium, type Page } from 'playwright';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function freePort() {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = (server.address() as { port: number }).port;
  await new Promise<void>(resolve => server.close(() => resolve())); return port;
}
async function screenPoint(page: Page, x: number, y: number) {
  return page.locator('#viewport').evaluate((node, point) => {
    const p = new DOMPoint(point.x, point.y).matrixTransform((node as SVGGraphicsElement).getScreenCTM()!);
    return { x: p.x, y: p.y };
  }, { x, y });
}
test('round swatch palettes, shape labels, arrow endpoints and attached movement work in the real browser', { timeout: 40_000 }, async () => {
  const port = await freePort(), token = 'diagram-test-token-0123456789012345';
  const transport = new StdioClientTransport({ command: process.execPath, args: ['--import', 'tsx', 'src/server.ts'], cwd: process.cwd(),
    env: { ...Object.fromEntries(Object.entries(process.env).filter((pair): pair is [string, string] => pair[1] !== undefined)), TABLETOP_PORT: String(port), TABLETOP_TOKEN: token }, stderr: 'pipe' });
  const client = new Client({ name: 'diagram-browser-test', version: '1.0.0' });
  const executablePath = process.env.TABLETOP_CHROME ?? (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
  const browser = await chromium.launch({ headless: true, executablePath });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  async function call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    assert.notEqual(result.isError, true, JSON.stringify(result));
    return JSON.parse((result.content as { text: string }[])[0].text);
  }
  async function color(role: 'fill' | 'stroke' | 'text', value: string) {
    await page.locator(`[data-color-role="${role}"]`).click();
    const popup = page.locator(`.palette-${role}`);
    await popup.waitFor({ state: 'visible' });
    assert.equal(await popup.locator('.pcr-swatches button').count(), 42);
    assert.equal(await popup.locator('.pcr-swatches').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 7);
    assert.equal(await popup.locator('.pcr-swatches button').first().evaluate(el => getComputedStyle(el).borderRadius), '50%');
    if (value === 'transparent') await popup.getByRole('button', { name: '透明（なし）' }).click();
    else await popup.locator(`.pcr-swatches button[title="${value}"]`).click();
    await popup.waitFor({ state: 'hidden' });
  }
  async function endpoint(side: 'start' | 'end', x: number, y: number, snapping: boolean) {
    const handle = page.locator(`[data-endpoint="${side}"]`), box = (await handle.boundingBox())!;
    const target = await screenPoint(page, x, y);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 5 });
    if (snapping) assert.equal(await page.locator('.snap-target.active').count(), 1);
    await page.mouse.up();
  }
  try {
    await client.connect(transport);
    await page.goto(`http://127.0.0.1:${port}/#token=${token}&port=${port}`);
    await page.waitForFunction(() => document.querySelector('#connection')?.textContent === 'MCP接続済み');
    await call('desk_execute', { operations: [
      { kind: 'add', object: { id: 'a', type: 'rect', x: 100, y: 100, width: 180, height: 100 } },
      { kind: 'add', object: { id: 'b', type: 'ellipse', x: 500, y: 100, width: 180, height: 100, text: '楕円ラベル' } },
      { kind: 'add', object: { id: 'c', type: 'arrow', x: 320, y: 350, x2: 520, y2: 350 } },
      { kind: 'add', object: { id: 't', type: 'text', x: 100, y: 450, text: 'テキスト', fill: '#000000' } },
    ] });
    await call('desk_select', { ids: [] });
    await page.locator('[data-id="a"] rect').dblclick();
    await page.locator('[data-inline-text]').fill('中央テキスト');
    await page.locator('[data-inline-text]').press('Enter');
    assert.equal((await call('desk_get', { id: 'a' })).text, '中央テキスト');
    assert.equal(await page.locator('[data-id="a"] .shape-text').textContent(), '中央テキスト');
    assert.equal(await page.locator('[data-id="a"] .shape-text tspan').getAttribute('x'), '90');
    await color('fill', '#22c55e'); assert.equal((await call('desk_get', { id: 'a' })).fill, '#22c55e');
    await color('fill', 'transparent'); assert.equal((await call('desk_get', { id: 'a' })).fill, 'transparent');
    await page.getByRole('button', { name: '元に戻す', exact: true }).click();
    assert.equal((await call('desk_get', { id: 'a' })).fill, '#22c55e');
    await color('stroke', '#1d4ed8'); assert.equal((await call('desk_get', { id: 'a' })).stroke, '#1d4ed8');
    await color('text', '#7f1d1d'); assert.equal((await call('desk_get', { id: 'a' })).textColor, '#7f1d1d');
    assert.equal(await page.locator('[data-id="a"] .shape-text').getAttribute('fill'), '#7f1d1d');
    await call('desk_select', { ids: ['t'] });
    assert.equal(await page.locator('[data-color-role="fill"]').isVisible(), false);
    await color('text', '#7e22ce'); assert.equal((await call('desk_get', { id: 't' })).fill, '#7e22ce');
    await call('desk_select', { ids: ['a', 'b'] });
    const revision = (await call('desk_summary')).revision;
    await color('fill', '#93c5fd');
    assert.equal((await call('desk_get', { id: 'a' })).fill, '#93c5fd');
    assert.equal((await call('desk_get', { id: 'b' })).fill, '#93c5fd');
    assert.equal((await call('desk_summary')).revision, revision + 1);
    await call('desk_select', { ids: ['c'] });
    assert.equal(await page.locator('[data-resize]').count(), 0);
    assert.equal(await page.locator('[data-endpoint]').count(), 2);
    assert.equal(await page.locator('#properties input[name="width"]').isVisible(), false);
    await color('stroke', '#b91c1c');
    assert.equal(await page.locator('[data-id="c"] .connector-line').getAttribute('stroke'), '#b91c1c');
    assert.equal(await page.locator('[data-id="c"] .arrow-head').getAttribute('fill'), '#b91c1c');
    await endpoint('end', 503, 152, true);
    assert.deepEqual((await call('desk_get', { id: 'c' })).endBinding, { objectId: 'b', anchor: 'left' });
    await endpoint('start', 282, 150, true);
    let connector = await call('desk_get', { id: 'c' });
    assert.deepEqual(connector.startBinding, { objectId: 'a', anchor: 'right' });
    assert.equal(connector.x, 280); assert.equal(connector.y, 150); assert.equal(connector.x2, 500); assert.equal(connector.y2, 150);
    // Clicking the body must not detach either endpoint or record a new revision.
    const beforeClick = (await call('desk_summary')).revision;
    const middle = await screenPoint(page, 390, 150); await page.mouse.click(middle.x, middle.y);
    assert.equal((await call('desk_summary')).revision, beforeClick);
    assert.deepEqual((await call('desk_get', { id: 'c' })).endBinding, connector.endBinding);
    // The old rectangular hit area is gone: clicking below the line clears selection.
    const blank = await screenPoint(page, 390, 240); await page.mouse.click(blank.x, blank.y);
    assert.deepEqual((await call('desk_selection')).ids, []);
    // Move the rectangle through the UI; the arrow follows even before release.
    const start = await screenPoint(page, 140, 125), target = await screenPoint(page, 180, 165);
    await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(target.x, target.y, { steps: 5 });
    assert.equal(await page.locator('[data-id="c"]').getAttribute('transform'), 'translate(320 190)');
    await page.mouse.up();
    connector = await call('desk_get', { id: 'c' }); assert.equal(connector.x, 320); assert.equal(connector.y, 190);
    await call('desk_execute', { operations: [{ kind: 'update', id: 'b', patch: { x: 550, height: 200 } }] });
    connector = await call('desk_get', { id: 'c' }); assert.equal(connector.x2, 550); assert.equal(connector.y2, 200);
    await call('desk_select', { ids: ['c'] });
    await endpoint('end', 600, 350, false);
    connector = await call('desk_get', { id: 'c' });
    assert.equal(connector.endBinding, null); assert.equal(connector.startBinding.objectId, 'a');
    // A line-body drag translates both endpoints and detaches the remaining binding.
    const body = await screenPoint(page, (connector.x + connector.x2) / 2, (connector.y + connector.y2) / 2);
    await page.mouse.move(body.x, body.y); await page.mouse.down(); await page.mouse.move(body.x + 25, body.y + 35, { steps: 4 }); await page.mouse.up();
    const shifted = await call('desk_get', { id: 'c' });
    assert.equal(shifted.x, connector.x + 25); assert.equal(shifted.y, connector.y + 35);
    assert.equal(shifted.x2, connector.x2 + 25); assert.equal(shifted.y2, connector.y2 + 35);
    assert.equal(shifted.startBinding, null);
    await call('desk_undo'); assert.equal((await call('desk_get', { id: 'c' })).startBinding.objectId, 'a');
    // Zoom must not change snapping tolerance in screen pixels.
    await page.getByRole('button', { name: '拡大', exact: true }).click();
    await endpoint('end', 556, 200, true);
    assert.equal((await call('desk_get', { id: 'c' })).endBinding.objectId, 'b');
    await call('desk_execute', { operations: [{ kind: 'delete', id: 'b' }] });
    assert.equal((await call('desk_get', { id: 'c' })).endBinding, null);
    await call('desk_undo'); assert.equal((await call('desk_get', { id: 'c' })).endBinding.objectId, 'b');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await client.close(); await transport.close(); }
});
