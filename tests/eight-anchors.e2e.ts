import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';

test('MCP corner and pin-center bindings render, drag-snap, follow and survive file round trip', { timeout: 30_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('eight-anchors');
  try {
    await call('desk_execute', { operations: [
      { kind: 'add', object: { id: 'rect', type: 'rect', x: 300, y: 200, width: 200, height: 120 } },
      { kind: 'label_add', id: 'pin', seriesId: 'series-1', x: 650, y: 200 },
      { kind: 'add', object: { id: 'edge', type: 'arrow', x: 100, y: 100, x2: 200, y2: 100 } },
    ] });
    await call('desk_select', { ids: ['edge'] });
    const handle = (await page.locator('[data-endpoint="end"]').boundingBox())!;
    const rect = (await page.locator('[data-id="rect"] > rect').boundingBox())!;
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down();
    await page.mouse.move(rect.x + rect.width, rect.y + rect.height, { steps: 3 });
    assert.equal(await page.locator('.snap-target, .snap-target.active').count(), 9);
    await page.mouse.up();
    assert.equal((await call('desk_get', { id: 'edge' })).endBinding.anchor, 'bottom-right');
    await call('desk_execute', { operations: [{ kind: 'update', id: 'edge', patch: { endBinding: { objectId: 'pin', anchor: 'center' } } }] });
    for (const zoom of [0.5, 2]) {
      await call('desk_camera_move', { zoom, durationMs: 0 });
      const result = await page.evaluate(() => {
        const pin = document.querySelector('[data-id="pin"] .pin-frame')!.getBoundingClientRect();
        const line = document.querySelector('[data-id="edge"] .connector-line') as SVGLineElement;
        const p = new DOMPoint(line.x2.baseVal.value, line.y2.baseVal.value).matrixTransform(line.getScreenCTM()!);
        return { dx: p.x - (pin.x + pin.width / 2), dy: p.y - (pin.y + pin.height / 2) };
      });
      assert.ok(Math.abs(result.dx) < 0.02); assert.ok(Math.abs(result.dy) < 0.02);
    }
    await call('desk_execute', { operations: [{ kind: 'update', id: 'edge', patch: { startBinding: { objectId: 'rect', anchor: 'bottom-right' } } }] });
    const saved = await call('desk_save', { filename: `eight-anchors-${Date.now()}.tabletop` });
    await call('desk_execute', { operations: [{ kind: 'delete', id: 'pin' }] });
    const now = await call('desk_summary');
    await call('desk_load', { filename: saved.filename, confirm: true, expectedSessionId: now.sessionId, expectedRevision: now.revision });
    assert.equal((await call('desk_get', { id: 'edge' })).endBinding.anchor, 'center');
    assert.equal((await call('desk_get', { id: 'edge' })).startBinding.anchor, 'bottom-right');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
