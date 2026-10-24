import {callTestTool} from './mcp-call';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { chromium } from 'playwright';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('toolbar, remembered numbering, descriptions and world grid work together', { timeout: 45_000 }, async () => {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = (server.address() as { port: number }).port;
  await new Promise<void>(resolve => server.close(() => resolve()));
  const token = 'toolbar-grid-test-012345678901234567';
  const transport = new StdioClientTransport({ command: process.execPath, args: ['--import', 'tsx', 'src/server.ts'], cwd: process.cwd(),
    env: { ...Object.fromEntries(Object.entries(process.env).filter((pair): pair is [string, string] => pair[1] !== undefined)), TABLETOP_PORT: String(port), TABLETOP_TOKEN: token }, stderr: 'pipe' });
  const client = new Client({ name: 'toolbar-grid-test', version: '1.0.0' });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.TABLETOP_CHROME ?? '/usr/bin/google-chrome' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  async function call(name: string, args: Record<string, unknown> = {}) {
    const result = await callTestTool(client, { name, arguments: args });
    assert.notEqual(result.isError, true, JSON.stringify(result));
    return JSON.parse((result.content as { text: string }[])[0].text);
  }
  async function point(x: number, y: number) {
    return page.locator('#viewport').evaluate((node, p) => {
      const result = new DOMPoint(p.x, p.y).matrixTransform((node as SVGGraphicsElement).getScreenCTM()!);
      return { x: result.x, y: result.y };
    }, { x, y });
  }
  async function place(x: number, y: number) {
    const id=(await call('desk_selection')).ids[0], object=id?await call('desk_get',{id}):null;
    if(object?.type==='label') {
      const start=await point(object.x+object.width/2,object.y+object.height*.35);
      const end=await point(x,y-object.height*.65);
      await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:5});await page.mouse.up();
    } else {const p=await point(x,y);await page.mouse.click(p.x,p.y);}
  }
  try {
    await client.connect(transport); await call('desk_pairing_open', { confirm: true }); await page.goto(`http://127.0.0.1:${port}/#token=${token}&port=${port}`);
    await page.waitForFunction(() => document.querySelector('#connection')?.textContent === 'MCP接続済み');
    assert.equal(await page.locator('nav > .toolbar-group').count(), 2);
    assert.equal(await page.locator('main > .toolbar-view').count(), 1);
    assert.equal(await page.locator('#grid-snap').getAttribute('aria-pressed'), 'true');
    await page.locator('#grid-snap').click();
    assert.equal(await page.locator('#grid-snap').getAttribute('aria-pressed'), 'false');
    await page.getByRole('button', { name: 'ピンを追加：数字', exact: true }).click();
    assert.equal(await page.locator('#series-panel').isVisible(), true);
    await place(300, 300); await page.keyboard.press('Escape');
    let objects = (await call('desk_list')).objects;
    assert.equal(objects[0].text, '1'); assert.equal(objects[0].x, 282); assert.equal(objects[0].y, 252);
    assert.equal(objects[0].labelShape, 'pin'); assert.equal(objects[0].width, 36);
    assert.equal(await page.locator(`[data-id="${objects[0].id}"] .pin-frame`).count(), 1);
    assert.equal(await page.locator(`[data-id="${objects[0].id}"] .shape-text tspan`).getAttribute('y'), '18');
    assert.equal(objects[0].x + objects[0].width / 2, 300);
    assert.equal(objects[0].y + objects[0].height, 300);
    await call('desk_select', { ids: [objects[0].id] });
    assert.equal(await page.locator('#series-panel').isVisible(), true);
    await page.locator('#pin-series-menu').click(); await page.locator('#pin-series-new').click();
    await page.locator('#series-settings [name="name"]').fill('手順');
    await page.locator('#series-settings [name="name"]').dispatchEvent('change');
    await page.locator('#series-settings [name="shape"]').selectOption('rect');
    await page.locator('#numbering-settings').click();
    await page.locator('#grid-snap').click();

    await place(413, 311); await page.keyboard.press('Escape');
    objects = (await call('desk_list')).objects; const label = objects[1];
    assert.equal(label.x + label.width / 2, 408); assert.equal(label.y + label.height, 312);
    await page.locator('#numbering').click(); await place(509, 311); await page.keyboard.press('Escape');
    objects = (await call('desk_list')).objects;
    assert.equal(objects[2].seriesId, label.seriesId); assert.equal(objects[2].text, '2');
    const center = await point(label.x + 24, label.y + 24); await page.mouse.dblclick(center.x, center.y);
    const input = page.getByRole('textbox', { name: 'ピンの説明文', exact: true });
    await input.fill('説明文\n二行目'); const revision = (await call('desk_summary')).revision;
    await input.press('Enter'); assert.equal((await call('desk_summary')).revision, revision + 1);
    assert.equal((await call('desk_get', { id: label.id })).description, '説明文\n二行目');
    assert.equal(await page.locator(`[data-id="${label.id}"] [data-label-description]`).count(), 1);
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'connection', type: 'arrow', x: 700, y: 500,
      endBinding: { objectId: label.id, anchor: 'bottom' } } }] });
    const connector = await call('desk_get', { id: 'connection' });
    const viewRevision = (await call('desk_summary')).revision;
    await page.locator('#label-descriptions').click();
    assert.equal(await page.locator('[data-label-description]').count(), 0);
    assert.equal((await call('desk_summary')).revision, viewRevision);
    assert.deepEqual(await call('desk_get', { id: 'connection' }), connector);
    await page.locator('#label-descriptions').click(); // pins -> hidden
    await page.locator('#label-descriptions').click(); // hidden -> all
    await call('desk_select', { ids: [label.id] });
    await page.mouse.move(center.x, center.y); await page.mouse.down();
    const destination = await point(label.x + 24 + 31, label.y + 24 + 27);
    await page.mouse.move(destination.x, destination.y, { steps: 5 });
    assert.equal(await page.locator('[data-grid-origin]').count(), 1);
    await page.mouse.up(); assert.equal(await page.locator('[data-grid-origin]').count(), 0);
    const moved = await call('desk_get', { id: label.id });
    assert.equal((moved.x + moved.width / 2) % 24, 0); assert.equal((moved.y + moved.height) % 24, 0);
    await page.locator('#zoom-in').click();
    assert.match((await page.locator('#dots').getAttribute('patternTransform'))!, /scale\(1.25\)/);
    await call('desk_execute', { operations: [{ kind: 'series_update', id: label.seriesId, patch: { shape: 'text' } }] });
    assert.deepEqual((await call('desk_get', { id: 'connection' })).endBinding, { objectId: label.id, anchor: 'bottom' });
    const selection = page.getByRole('button', { name: '選択モード（Esc）', exact: true });
    assert.equal(await selection.getAttribute('aria-pressed'), 'true');
    await page.locator('#numbering').click();
    assert.equal(await selection.getAttribute('aria-pressed'), 'true');
    const selectRevision = (await call('desk_summary')).revision;
    await selection.click();
    assert.equal(await selection.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#numbering').getAttribute('aria-pressed'), null);
    assert.equal((await call('desk_summary')).revision, selectRevision);
    const countBeforeSelection = (await call('desk_summary')).count;
    const startMove = await point(moved.x + 24, moved.y + 24);
    const endMove = await point(moved.x + 48, moved.y + 48);
    await page.mouse.move(startMove.x, startMove.y); await page.mouse.down();
    await page.mouse.move(endMove.x, endMove.y, { steps: 3 }); await page.mouse.up();
    assert.equal((await call('desk_summary')).count, countBeforeSelection);
    assert.equal((await call('desk_get', { id: label.id })).x, moved.x + 24);
    await page.locator('#numbering').click(); await page.keyboard.press('Escape');
    assert.equal(await selection.getAttribute('aria-pressed'), 'true');
    await page.locator('#numbering').click(); await page.getByRole('button', { name: '図形の候補', exact: true }).click();
    await page.getByRole('dialog', { name: '図形の候補', exact: true }).getByRole('button', { name: '矩形', exact: true }).click();
    assert.equal(await selection.getAttribute('aria-pressed'), 'true');
    await place(750, 550);
    assert.equal((await call('desk_summary')).count, countBeforeSelection + 3);
    await call('desk_execute', { operations: [{ kind: 'series_update', id: label.seriesId, patch: { width: 80, height: 72, shape: 'pin' } }] });
    await call('desk_select', { ids: [label.id] });
    await page.locator('#series-choice').selectOption(label.seriesId);
    assert.equal((await call('desk_get', { id: label.id })).width, 80);
    const beforeFit = await call('desk_get', { id: label.id });
    const fitRevision = (await call('desk_summary')).revision;
    await page.getByRole('button', { name: '枠を文字にあわせる', exact: true }).click();
    const fitted = await call('desk_get', { id: label.id });
    assert.equal(fitted.width, 36); assert.equal(fitted.height, 48);
    assert.equal(fitted.x, beforeFit.x); assert.equal(fitted.number, beforeFit.number); assert.equal(fitted.description, beforeFit.description);
    assert.equal((await call('desk_summary')).revision, fitRevision + 1);
    await call('desk_undo'); assert.deepEqual(await call('desk_get', { id: label.id }), beforeFit);
    await page.locator('#series-settings [name="shape"]').selectOption('ellipse');
    assert.equal((await call('desk_get', { id: label.id })).width, 80);
    await page.getByRole('button', { name: '枠を文字にあわせる', exact: true }).click();
    assert.equal((await call('desk_get', { id: label.id })).height, 36);
    await page.setViewportSize({ width: 720, height: 1000 });
    assert.equal(await page.locator('nav').evaluate(node => node.scrollWidth <= node.clientWidth), true);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator('nav').evaluate(node => node.scrollWidth <= node.clientWidth), true);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await client.close(); await transport.close(); }
});
