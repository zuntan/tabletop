import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';

test('mouse joins endpoints symmetrically; normal drag follows and Alt drag detaches with Undo and save/load', { timeout: 30_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('junctions');
  page.setDefaultTimeout(5000);
  try {
    await call('desk_execute', { operations: [
      { kind: 'grid_update', patch: { enabled: false } },
      { kind: 'add', object: { id: 'a', type: 'line', x: 100, y: 200, x2: 300, y2: 200 } },
      { kind: 'add', object: { id: 'b', type: 'line', x: 500, y: 300, x2: 700, y2: 400 } },
    ] });
    const screen = (x: number, y: number) => page.locator('#viewport').evaluate((el, p) => {
      const matrix = (el as unknown as SVGGraphicsElement).getScreenCTM()!;
      const point = new DOMPoint(p.x, p.y).matrixTransform(matrix); return { x: point.x, y: point.y };
    }, { x, y });
    async function drag(id: string, side: string, x: number, y: number, alt = false) {
      await call('desk_select', { ids: [id] });
      const handle = page.locator('[data-connector="' + id + '"][data-endpoint="' + side + '"]');
      const box = (await handle.boundingBox())!, target = await screen(x, y);
      if (alt) await page.keyboard.down('Alt');
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down(); await page.mouse.move(target.x, target.y, { steps: 6 }); await page.mouse.up();
      if (alt) await page.keyboard.up('Alt');
    }
    await drag('b', 'start', 300, 200);
    const a = await call('desk_get', { id: 'a' }), b = await call('desk_get', { id: 'b' });
    assert.ok(a.endJunction); assert.equal(a.endJunction, b.startJunction);
    assert.equal(await page.locator('[data-connector=b][data-endpoint=start]').getAttribute('fill'), '#16a34a');
    await drag('a', 'end', 350, 230);
    assert.equal((await call('desk_get', { id: 'b' })).x, 350);
    assert.equal((await call('desk_get', { id: 'b' })).x2, 700);
    const before = await call('desk_state');
    await drag('b', 'start', 450, 300, true);
    assert.equal((await call('desk_get', { id: 'b' })).startJunction, null);
    assert.equal((await call('desk_get', { id: 'a' })).x2, 350);
    await call('desk_undo');
    assert.deepEqual((await call('desk_state')).objects, before.objects);
    const saved = await call('desk_save', { filename: 'junction-e2e-' + Date.now() + '.tabletop' });
    await call('desk_redo');
    const current = await call('desk_summary');
    await call('desk_load', { filename: saved.filename, confirm: true, expectedSessionId: current.sessionId, expectedRevision: current.revision });
    assert.deepEqual((await call('desk_state')).objects, before.objects);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
