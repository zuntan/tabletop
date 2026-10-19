import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';

test('pin drag attaches its fixed-size tip, follows a card and Alt peels off at different zooms', { timeout: 30_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('pin-attachments');
  page.setDefaultTimeout(5000);
  try {
    await call('desk_execute', { operations: [
      { kind: 'grid_update', patch: { enabled: false } },
      { kind: 'add', object: { id: 'card', type: 'text', x: 300, y: 200, width: 200, height: 150, text: '留め先' } },
      { kind: 'label_add', id: 'pin', seriesId: 'series-1', x: 100, y: 100 },
    ] });
    async function dragTip(x: number, y: number, alt = false) {
      await call('desk_select', { ids: ['pin'] });
      const positions = await page.evaluate(({ x, y }) => {
        const group = document.querySelector('[data-id="pin"]') as unknown as SVGGElement;
        const frame = group.querySelector('.pin-frame')!.getBoundingClientRect();
        const matrix = (document.querySelector('#viewport') as unknown as SVGGraphicsElement).getScreenCTM()!;
        const target = new DOMPoint(x, y).matrixTransform(matrix);
        const tip = new DOMPoint(18, 48).matrixTransform(group.getScreenCTM()!);
        return { startX: frame.x + frame.width / 2, startY: frame.y + frame.height / 3, dx: target.x - tip.x, dy: target.y - tip.y };
      }, { x, y });
      if (alt) await page.keyboard.down('Alt');
      await page.mouse.move(positions.startX, positions.startY); await page.mouse.down();
      await page.mouse.move(positions.startX + positions.dx, positions.startY + positions.dy, { steps: 8 });
      await page.mouse.up(); if (alt) await page.keyboard.up('Alt');
    }
    for (const zoom of [0.5, 2]) {
      await call('desk_camera_move', { center: { x: 350, y: 250 }, zoom, durationMs: 0 });
      await dragTip(400, 200);
      assert.deepEqual((await call('desk_get', { id: 'pin' })).attachment, { objectId: 'card', anchor: 'top' });
      await call('desk_execute', { operations: [{ kind: 'update', id: 'card', patch: { x: 330, width: 240 } }] });
      const pin = await call('desk_get', { id: 'pin' });
      assert.equal(pin.x + pin.width / 2, 450); assert.equal(pin.y + pin.height, 200);
      const before = (await call('desk_state')).objects;
      await dragTip(550, 400, true);
      assert.equal((await call('desk_get', { id: 'pin' })).attachment, null);
      await call('desk_undo'); assert.deepEqual((await call('desk_state')).objects, before);
      await call('desk_execute', { operations: [
        { kind: 'update', id: 'pin', patch: { attachment: null, x: 100, y: 100 } },
        { kind: 'update', id: 'card', patch: { x: 300, width: 200 } },
      ] });
    }
    await page.locator('#numbering').click();
    const target = await page.locator('#viewport').evaluate(el => {
      const point = new DOMPoint(500, 275).matrixTransform((el as unknown as SVGGraphicsElement).getScreenCTM()!);
      return { x: point.x, y: point.y };
    });
    await page.mouse.click(target.x, target.y);
    const placed = (await call('desk_context')).objects.find((o: { type: string; id: string }) => o.type === 'label' && o.id !== 'pin');
    assert.deepEqual(placed.attachment, { objectId: 'card', anchor: 'right' });
    await page.locator('#selection-mode').click();
    const saved = await call('desk_save', { filename: 'pin-attachment-' + Date.now() + '.tabletop' });
    const current = await call('desk_summary');
    await call('desk_load', { filename: saved.filename, confirm: true, expectedSessionId: current.sessionId, expectedRevision: current.revision });
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
