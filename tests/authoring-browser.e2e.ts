import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { chromium } from 'playwright';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('defaults, inline editing and independent numbering systems work through UI and MCP', { timeout: 45_000 }, async () => {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = (server.address() as { port: number }).port; await new Promise<void>(resolve => server.close(() => resolve()));
  const token = 'authoring-test-token-0123456789012345';
  const transport = new StdioClientTransport({ command: process.execPath, args: ['--import', 'tsx', 'src/server.ts'], cwd: process.cwd(),
    env: { ...Object.fromEntries(Object.entries(process.env).filter((pair): pair is [string, string] => pair[1] !== undefined)), TABLETOP_PORT: String(port), TABLETOP_TOKEN: token }, stderr: 'pipe' });
  const client = new Client({ name: 'authoring-browser-test', version: '1.0.0' });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.TABLETOP_CHROME ?? '/usr/bin/google-chrome' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1050 } });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => { errors.push('Unexpected native dialog'); void dialog.dismiss(); });
  async function call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    assert.notEqual(result.isError, true, JSON.stringify(result));
    return JSON.parse((result.content as { text: string }[])[0].text);
  }
  async function color(role: string, value: string) {
    await page.locator(`[data-color-role="${role}"]`).click();
    await page.locator(`.palette-${role} .pcr-swatches button[title="${value}"]`).click();
  }
  async function point(x: number, y: number) {
    return page.locator('#viewport').evaluate((node, p) => {
      const result = new DOMPoint(p.x, p.y).matrixTransform((node as SVGGraphicsElement).getScreenCTM()!);
      return { x: result.x, y: result.y };
    }, { x, y });
  }
  async function place(x: number, y: number) { const p = await point(x, y); await page.mouse.click(p.x, p.y); }
  try {
    await client.connect(transport); await call('desk_pairing_open', { confirm: true }); await page.goto(`http://127.0.0.1:${port}/#token=${token}&port=${port}`);
    await page.waitForFunction(() => document.querySelector('#connection')?.textContent === 'MCP接続済み');
    await color('default-fill', '#22c55e');
    await page.locator('[data-add="roundedRect"]').click();
    const first = (await call('desk_list')).objects[0]; assert.equal(first.fill, '#22c55e');
    assert.equal(await page.locator(`[data-id="${first.id}"] rect`).getAttribute('rx'), '16');
    const before = (await call('desk_summary')).revision;
    await color('default-fill', '#93c5fd');
    assert.equal((await call('desk_get', { id: first.id })).fill, '#93c5fd');
    assert.equal((await call('desk_summary')).revision, before + 1);
    await page.locator('#default-width').fill('5'); await page.locator('#default-width').dispatchEvent('change');
    assert.equal((await call('desk_get', { id: first.id })).strokeWidth, 5);
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'different', type: 'ellipse', x: 500, y: 50, fill: '#ffffff' } }] });
    await call('desk_select', { ids: ['different'] });
    assert.equal((await call('desk_settings')).defaults.fill, '#93c5fd');
    await page.locator('[data-add="rect"]').click();
    assert.equal((await call('desk_list')).objects.at(-1).fill, '#93c5fd');
    await call('desk_select', { ids: [first.id] });
    await page.locator('#front').click();
    await page.locator(`[data-id="${first.id}"] rect`).dblclick();
    const input = page.locator('[data-inline-text]'); await input.fill('IME確定');
    const editRevision = (await call('desk_summary')).revision;
    await input.evaluate(node => node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true })));
    assert.equal(await input.count(), 1); assert.equal((await call('desk_summary')).revision, editRevision);
    await input.press('Shift+Enter'); await input.type('二行目'); await input.press('Enter');
    assert.equal((await call('desk_get', { id: first.id })).text, 'IME確定\n二行目');
    assert.equal((await call('desk_summary')).revision, editRevision + 1);
    await call('desk_undo'); assert.equal((await call('desk_get', { id: first.id })).text, '');
    await page.locator(`[data-id="${first.id}"] rect`).dblclick(); await input.fill('取消'); await input.press('Escape');
    assert.equal((await call('desk_get', { id: first.id })).text, '');
    await page.locator('[data-add="text"]').click(); await input.fill('単独テキスト'); await input.press('Enter');
    const text = (await call('desk_list')).objects.at(-1); assert.equal(text.text, '単独テキスト');
    await page.locator('[data-add="link"]').click(); await input.fill('資料');
    const url = page.locator('[data-inline-url]'); await url.fill('javascript:alert(1)'); await url.press('Enter');
    assert.equal(await url.count(), 1); assert.equal((await call('desk_summary')).count, 4);
    await url.fill('https://example.com/path'); await url.press('Enter');
    const link = (await call('desk_list')).objects.at(-1); assert.equal(link.text, '資料'); assert.equal(link.url, 'https://example.com/path');
    await page.locator(`[data-id="${link.id}"] > rect`).dblclick(); await input.fill('表示名変更');
    await page.locator('#revision').click(); assert.equal((await call('desk_get', { id: link.id })).text, '表示名変更');
    await page.locator('#numbering-settings').click(); await page.locator('#numbering').click();
    await place(350, 360); await place(450, 360); await page.keyboard.press('Escape');
    let labels = (await call('desk_list')).objects.filter((object: { type: string }) => object.type === 'label');
    assert.deepEqual(labels.map((object: { text: string }) => object.text), ['1', '2']);
    await call('desk_select', { ids: [labels[0].id] });
    await page.locator('#series-settings [name="format"]').selectOption('upper-alpha');
    await page.locator('#series-settings [name="shape"]').selectOption('roundedRect');
    await color('series-text', '#b91c1c');
    labels = (await call('desk_list')).objects.filter((object: { type: string }) => object.type === 'label');
    assert.deepEqual(labels.map((object: { text: string }) => object.text), ['A', 'B']);
    await call('desk_select', { ids: labels.map((object: { id: string }) => object.id) });
    await page.locator('#default-width').fill('7'); await page.locator('#default-width').dispatchEvent('change');
    assert.equal((await call('desk_get', { id: labels[0].id })).strokeWidth, 7);
    await call('desk_select', { ids: [labels[0].id] });
    assert.equal(await page.locator('[data-resize]').count(), 0);
    assert.equal(await page.locator('#properties [name="fontSize"]').isDisabled(), true);
    assert.equal(await page.locator('#properties [name="x"]').isDisabled(), false);
    await page.locator('#series-add').click();
    await page.locator('#series-settings [name="format"]').selectOption('upper-alpha');
    await color('series-text', '#1d4ed8'); await page.locator('#numbering').click(); await place(550, 360); await page.keyboard.press('Escape');
    const all = (await call('desk_list')).objects.filter((object: { type: string }) => object.type === 'label');
    assert.equal(all[2].text, 'A'); assert.notEqual(all[0].seriesId, all[2].seriesId);
    assert.equal(all[0].textColor, '#b91c1c'); assert.equal(all[2].textColor, '#1d4ed8');
    const settings = await call('desk_settings'); assert.equal(settings.series.length, 2);
    await call('desk_execute', { operations: [{ kind: 'delete', id: all[2].id }] });
    assert.equal((await call('desk_settings')).series[1].next, 1);
    await call('desk_undo'); assert.equal((await call('desk_settings')).series[1].next, 2);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await client.close(); await transport.close(); }
});
