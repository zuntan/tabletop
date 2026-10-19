import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { openTestDesk } from './desk-browser';
import { decodeDeskFile } from '../src/desk-file';

test('shared snap defaults, public MCP placement, exact numeric editing and saved custom grid stay in sync', { timeout: 45_000 }, async () => {
  const { page, client, call, close, errors } = await openTestDesk('shared-grid');
  async function execute(operations: unknown[], extra: Record<string, unknown> = {}) {
    const result = await client.callTool({ name: 'desk_execute', arguments: { operations, ...extra } });
    assert.notEqual(result.isError, true, JSON.stringify(result));
    return JSON.parse((result.content as { text: string }[])[0].text);
  }
  try {
    const button = page.getByRole('button', { name: 'グリッドにスナップ', exact: true });
    assert.equal(await button.getAttribute('aria-pressed'), 'true'); assert.match(await button.innerText(), /スナップ/);
    assert.deepEqual((await call('desk_settings')).grid, { enabled: true, interval: 24, origin: { x: 0, y: 0 } });
    const placed = await execute([{ kind: 'add', object: { id: 'r', type: 'rect', x: 35, y: -35 } }]);
    assert.equal(placed.placement.mode, 'desk'); assert.equal(placed.placement.results[0].applied.x, 24);
    assert.equal(placed.placement.results[0].snapped, true);
    assert.equal(await page.locator('[data-id="r"]').getAttribute('transform'), 'translate(24 -24)');
    await page.getByRole('button', { name: '矩形', exact: true }).click();
    const created = (await call('desk_list')).objects.at(-1);
    assert.equal(created.x % 24, 0); assert.equal(created.y % 24, 0);
    await call('desk_select', { ids: [] });
    await page.getByRole('button', { name: '線', exact: true }).click();
    const line = (await call('desk_list')).objects.at(-1);
    for (const field of ['x', 'y', 'x2', 'y2']) assert.equal(line[field] % 24, 0);
    const revision = (await call('desk_summary')).revision;
    await execute([{ kind: 'add', object: { id: 'precise', type: 'rect', x: 301.5, y: 41.25 } }], { snap: 'exact' });
    assert.equal((await call('desk_get', { id: 'precise' })).x, 301.5);
    assert.equal((await call('desk_summary')).revision, revision + 1); assert.equal(await button.getAttribute('aria-pressed'), 'true');
    await call('desk_select', { ids: ['precise'] });
    await page.locator('#properties [name="x"]').fill('307.5');
    await page.locator('#properties [name="x"]').press('Enter');
    assert.equal((await call('desk_get', { id: 'precise' })).x, 307.5);
    await button.click(); assert.equal((await call('desk_settings')).grid.enabled, false);
    await execute([{ kind: 'add', object: { id: 'off', type: 'rect', x: 35, y: 35 } }]);
    assert.equal((await call('desk_get', { id: 'off' })).x, 35);
    await execute([{ kind: 'grid_update', patch: { enabled: true, interval: 10, origin: { x: 3, y: -4 } } }]);
    assert.equal(await button.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#dots').getAttribute('width'), '10');
    assert.equal(await page.locator('#dots').getAttribute('x'), '-2');
    const imported = await call('desk_asset_import', { id: 'picture', source: { svg: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>' }, x: 99, y: 99, snap: 'desk' });
    assert.equal(imported.placement.results[0].applied.x, 103); assert.equal(imported.placement.results[0].applied.y, 96);
    const box = (await page.locator('[data-id="r"]').boundingBox())!;
    await page.mouse.move(box.x + 20, box.y + 20); await page.mouse.down();
    await page.mouse.move(box.x + 41, box.y + 41, { steps: 3 }); await page.mouse.up();
    const dragged = await call('desk_get', { id: 'r' });
    assert.deepEqual({ x: dragged.x, y: dragged.y }, { x: 43, y: -4 });
    const downloadPromise = page.waitForEvent('download'); await page.locator('#save-desk').click();
    const bytes = await readFile((await (await downloadPromise).path())!);
    assert.deepEqual((await decodeDeskFile(bytes)).settings.grid, { enabled: true, interval: 10, origin: { x: 3, y: -4 } });
    await execute([{ kind: 'grid_update', patch: { enabled: false, interval: 24, origin: { x: 0, y: 0 } } }]);
    assert.equal(await button.getAttribute('aria-pressed'), 'false');
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#desk-file').setInputFiles({ name: 'grid.tabletop', mimeType: 'application/zip', buffer: bytes });
    await page.waitForFunction(() => document.querySelector('#message')?.textContent === '読込完了');
    assert.deepEqual((await call('desk_context')).settings.grid, { enabled: true, interval: 10, origin: { x: 3, y: -4 } });
    assert.equal(await button.getAttribute('aria-pressed'), 'true'); assert.equal(await page.locator('#dots').getAttribute('width'), '10');
    await page.locator('#undo').click();
    assert.equal(await button.getAttribute('aria-pressed'), 'false'); assert.equal(await page.locator('#dots').getAttribute('width'), '24');
    await page.locator('#redo').click(); assert.equal(await button.getAttribute('aria-pressed'), 'true');
    const after = await execute([{ kind: 'update', id: 'r', patch: { x: 35, y: 35 } }]);
    assert.deepEqual({ x: after.placement.results[0].applied.x, y: after.placement.results[0].applied.y }, { x: 33, y: 36 });
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
