import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Desk, objectSchema } from '../src/model';
import { anchorPoint, anchorsFor, snap } from '../src/geometry';
import { selectedConnection } from '../src/connection-creation';

test('rectangles expose eight anchors; curved corners stay on their outline', () => {
  const rect = objectSchema.parse({ id: 'rect', type: 'rect', x: 10, y: 20, width: 100, height: 80 });
  assert.equal(anchorsFor(rect).length, 8);
  for (const [anchor, x, y] of [['top-left', 10, 20], ['top-right', 110, 20], ['bottom-left', 10, 100], ['bottom-right', 110, 100]] as const) {
    assert.deepEqual(anchorPoint(rect, anchor), { x, y });
    assert.equal(snap({ x, y }, [rect], 1)?.binding.anchor, anchor);
  }
  const rounded = { ...rect, type: 'roundedRect' as const, cornerRadius: 20 };
  const corner = anchorPoint(rounded, 'top-left');
  assert.ok(Math.abs(Math.hypot(corner.x - 30, corner.y - 40) - 20) < 1e-8);
  const ellipse = { ...rect, type: 'ellipse' as const };
  const e = anchorPoint(ellipse, 'bottom-right');
  assert.ok(Math.abs(((e.x - 60) / 50) ** 2 + ((e.y - 60) / 40) ** 2 - 1) < 1e-8);
});

test('new pin snapping and selection creation use only center; diagonal selection uses corners', () => {
  const pin = objectSchema.parse({ id: 'pin', type: 'label', labelShape: 'pin', x: 200, y: 200, width: 36, height: 48 });
  assert.deepEqual(anchorsFor(pin), ['center']);
  assert.deepEqual(snap({ x: 218, y: 224 }, [pin], 1)?.binding, { objectId: 'pin', anchor: 'center' });
  assert.equal(snap({ x: 200, y: 200 }, [pin], 1), null);
  assert.equal(selectedConnection([pin]).startBinding?.anchor, 'center');
  const a = objectSchema.parse({ id: 'a', type: 'rect', x: 0, y: 0, width: 100, height: 100 });
  const b = { ...a, id: 'b', x: 200, y: 200 };
  const connection = selectedConnection([a, b]);
  assert.equal(connection.startBinding?.anchor, 'bottom-right');
  assert.equal(connection.endBinding?.anchor, 'top-left');
});

test('corner bindings follow move and resize with shared undo; legacy pin side bindings stay valid', () => {
  const desk = new Desk();
  desk.execute({ operations: [
    { kind: 'add', object: { id: 'rect', type: 'rect', x: 100, y: 100, width: 100, height: 100 } },
    { kind: 'label_add', id: 'pin', seriesId: 'series-1', x: 300, y: 300 },
    { kind: 'add', object: { id: 'edge', type: 'arrow', x: 0, y: 0, x2: 0, y2: 0,
      startBinding: { objectId: 'rect', anchor: 'bottom-right' }, endBinding: { objectId: 'pin', anchor: 'left' } } },
  ] });
  assert.equal(desk.get('edge').x, 200); assert.equal(desk.get('edge').y, 200);
  const saved = { objects: desk.snapshot(), settings: desk.settingsSnapshot() };
  const restored = new Desk(); restored.replaceDocument(saved);
  assert.deepEqual(restored.get('edge').endBinding, { objectId: 'pin', anchor: 'left' });
  desk.execute({ operations: [{ kind: 'update', id: 'rect', patch: { x: 150, width: 200 } }] });
  assert.equal(desk.get('edge').x, 350); assert.equal(desk.get('edge').y, 200);
  desk.undo(); assert.equal(desk.get('edge').x, 200);
  desk.execute({ operations: [{ kind: 'delete', id: 'rect' }] });
  assert.equal(desk.get('edge').startBinding, null); assert.equal(desk.get('edge').x, 200);
});
