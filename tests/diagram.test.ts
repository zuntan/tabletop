import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Desk, objectSchema } from '../src/model.js';
import { anchorPoint, bounds, endpoints, snap } from '../src/geometry.js';
import { gestureOperations, gesturePreview, type Gesture } from '../src/diagram-gestures.js';

const shape = (id = 'shape', type: 'rect' | 'ellipse' = 'rect') => objectSchema.parse({ id, type, x: 100, y: 100, width: 200, height: 100 });
const arrow = (id = 'arrow') => objectSchema.parse({ id, type: 'arrow', x: 20, y: 30, x2: 80, y2: 90 });
const connected = () => objectSchema.parse({ ...arrow(), endBinding: { objectId: 'shape', anchor: 'left' } });
function gesture(desk: Desk, ids: string[], mode: Gesture['mode'] = 'move'): Gesture {
  const scene = desk.snapshot();
  return { mode, originals: ids.map(id => desk.get(id)), scene, preview: scene, revision: desk.revision,
    start: { x: 0, y: 0 }, screen: { x: 0, y: 0 }, camera: { x: 0, y: 0 }, additive: [] };
}
test('explicit endpoints support all directions including horizontal, vertical and zero length', () => {
  for (const point of [{ x: -40, y: -30 }, { x: 20, y: 300 }, { x: 300, y: 30 }, { x: 20, y: 30 }]) {
    const desk = new Desk();
    desk.execute({ operations: [{ kind: 'add', object: { ...arrow(), x2: point.x, y2: point.y } }] });
    assert.deepEqual(endpoints(desk.get('arrow')).end, point);
    assert.deepEqual(bounds(desk.get('arrow')), { x: Math.min(20, point.x), y: Math.min(30, point.y), width: Math.abs(point.x - 20), height: Math.abs(point.y - 30) });
  }
});
test('legacy line geometry is converted without changing its visual endpoints', () => {
  const desk = new Desk();
  desk.execute({ operations: [{ kind: 'add', object: objectSchema.parse({ id: 'line', type: 'line', x: 10, y: 20, width: 100, height: 60 }) }] });
  assert.deepEqual(endpoints(desk.get('line')), { start: { x: 10, y: 80 }, end: { x: 110, y: 20 } });
});
test('snapping preserves side anchors, screen-space tolerance and frontmost ties', () => {
  const rect = shape(), ellipse = shape('ellipse', 'ellipse');
  assert.deepEqual(anchorPoint(ellipse, 'bottom'), { x: 200, y: 200 });
  assert.equal(snap({ x: 105, y: 152 }, [rect, ellipse], 9)?.binding.objectId, 'ellipse');
  assert.equal(snap({ x: 120, y: 150 }, [rect], 9), null);
  assert.equal(snap({ x: 200, y: 150 }, [rect], 9), null);
});
test('forward references and both bindings resolve after the atomic batch', () => {
  const desk = new Desk();
  const link = { ...arrow(), startBinding: { objectId: 'shape', anchor: 'right' as const }, endBinding: { objectId: 'ellipse', anchor: 'left' as const } };
  desk.execute({ operations: [{ kind: 'add', object: link }, { kind: 'add', object: shape() }, { kind: 'add', object: { ...shape('ellipse', 'ellipse'), x: 500 } }] });
  assert.deepEqual(endpoints(desk.get('arrow')), { start: { x: 300, y: 150 }, end: { x: 500, y: 150 } });
});
test('moving and resizing targets updates connections in the same revision and undo step', () => {
  const desk = new Desk();
  desk.execute({ operations: [{ kind: 'add', object: shape() }, { kind: 'add', object: connected() }] });
  desk.execute({ actor: 'human', operations: [{ kind: 'update', id: 'shape', patch: { x: 200, y: 220, height: 200 } }] });
  assert.deepEqual(endpoints(desk.get('arrow')).end, { x: 200, y: 320 });
  const change = desk.getChanges(1).changes[0];
  assert.deepEqual(change.details.map(d => d.id), ['shape', 'arrow']);
  assert.equal(change.revision, 2);
  desk.undo(); assert.deepEqual(endpoints(desk.get('arrow')).end, { x: 100, y: 150 });
  desk.redo(); assert.deepEqual(endpoints(desk.get('arrow')).end, { x: 200, y: 320 });
});
test('deletion detaches while preserving endpoint; undo restores connection', () => {
  const desk = new Desk();
  desk.execute({ operations: [{ kind: 'add', object: shape() }, { kind: 'add', object: connected() }] });
  desk.execute({ operations: [{ kind: 'delete', id: 'shape' }] });
  assert.equal(desk.get('arrow').endBinding, null);
  assert.deepEqual(endpoints(desk.get('arrow')).end, { x: 100, y: 150 });
  desk.undo(); assert.equal(desk.get('arrow').endBinding?.objectId, 'shape');
});
test('invalid bindings and endpoint misuse reject the whole transaction', () => {
  const desk = new Desk();
  assert.throws(() => desk.execute({ operations: [{ kind: 'add', object: connected() }] }));
  assert.equal(desk.revision, 0);
  assert.throws(() => desk.execute({ operations: [{ kind: 'add', object: { ...arrow(), x2: undefined } }] }));
  assert.throws(() => desk.execute({ operations: [{ kind: 'add', object: { ...shape(), x2: 1, y2: 1 } }] }));
  assert.throws(() => desk.execute({ operations: [
    { kind: 'add', object: arrow('target') }, { kind: 'add', object: { ...arrow(), endBinding: { objectId: 'target', anchor: 'left' } } },
  ] }));
  assert.equal(desk.summary().count, 0);
});
test('a click does not detach; dragging the line moves both endpoints and detaches', () => {
  const desk = new Desk();
  desk.execute({ operations: [{ kind: 'add', object: shape() }, { kind: 'add', object: connected() }] });
  const g = gesture(desk, ['arrow']);
  assert.deepEqual(gestureOperations(g, { x: 0, y: 0 }, 1), []);
  const preview = gesturePreview(g, { x: 10, y: 20 }, 1).find(o => o.id === 'arrow')!;
  assert.deepEqual(endpoints(preview), { start: { x: 30, y: 50 }, end: { x: 110, y: 170 } });
  assert.equal(preview.endBinding, null);
  assert.equal(desk.get('arrow').endBinding?.objectId, 'shape');
  desk.execute({ operations: gestureOperations(g, { x: 10, y: 20 }, 1) });
  assert.deepEqual(desk.get('arrow'), preview);
});
test('endpoint drag snaps one end and preserves the other; target previews are consistent', () => {
  const desk = new Desk();
  desk.execute({ operations: [{ kind: 'add', object: shape() }, { kind: 'add', object: arrow() }] });
  const g = gesture(desk, ['arrow'], 'end');
  desk.execute({ operations: gestureOperations(g, { x: 24, y: 62 }, 1) });
  assert.deepEqual(endpoints(desk.get('arrow')), { start: { x: 20, y: 30 }, end: { x: 100, y: 150 } });
  assert.equal(desk.get('arrow').endBinding?.anchor, 'left');
  const move = gesture(desk, ['shape']);
  const preview = gesturePreview(move, { x: -20, y: 30 }, 1);
  assert.deepEqual(endpoints(preview.find(o => o.id === 'arrow')!).end, { x: 80, y: 180 });
  desk.execute({ operations: gestureOperations(move, { x: -20, y: 30 }, 1) });
  assert.deepEqual(desk.snapshot(), preview);
});
test('shape text and independent transparent colors survive shared undo/redo', () => {
  const desk = new Desk();
  desk.execute({ operations: [{ kind: 'add', object: { ...shape(), text: 'Hello\nWorld' } }] });
  desk.execute({ operations: [{ kind: 'update', id: 'shape', patch: { fill: 'transparent', stroke: '#22c55e', textColor: '#7f1d1d' } }] });
  assert.equal(desk.get('shape').textColor, '#7f1d1d');
  assert.equal(desk.get('shape').text, 'Hello\nWorld');
  desk.undo(); assert.equal(desk.get('shape').fill, '#dbeafe');
  desk.redo(); assert.equal(desk.get('shape').fill, 'transparent');
});
