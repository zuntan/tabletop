import { test } from 'node:test';
import assert from 'node:assert/strict';
import { objectSchema } from '../src/model.js';
import { gridPoint, gridOrigin } from '../src/grid.js';
import { gestureOperations, type Gesture } from '../src/diagram-gestures.js';

const rect = objectSchema.parse({ id: 'r', type: 'rect', x: 13, y: 17, width: 48, height: 48 });
const label = objectSchema.parse({ id: 'l', type: 'label', x: 100, y: 110, width: 48, height: 48, description: '説明' });
function gesture(originals = [rect], mode: Gesture['mode'] = 'move'): Gesture {
  return { mode, start: { x: 0, y: 0 }, screen: { x: 0, y: 0 }, camera: { x: 0, y: 0 },
    originals, scene: originals, preview: originals, revision: 0, additive: [], grid: true };
}
test('grid uses fixed world units and label bottom centers regardless of descriptions', () => {
  assert.deepEqual(gridPoint({ x: 35, y: -35 }), { x: 24, y: -24 });
  assert.deepEqual(gridOrigin(label), { x: 124, y: 158 });
  for (const zoom of [0.5, 1, 2]) {
    const operations = gestureOperations(gesture([label]), { x: 21, y: 21 }, zoom);
    assert.deepEqual(operations, [{ kind: 'update', id: 'l', patch: { x: 120, y: 120 } }]);
  }
});
test('multi-object grid moves preserve relative positions and use the active object', () => {
  const current = gesture([rect, label]); current.anchorId = 'l';
  const operations = gestureOperations(current, { x: 21, y: 21 }, 1);
  assert.deepEqual(operations, [
    { kind: 'update', id: 'r', patch: { x: 33, y: 27 } },
    { kind: 'update', id: 'l', patch: { x: 120, y: 120 } },
  ]);
  assert.deepEqual(gestureOperations(current, { x: 0, y: 0 }, 1), []);
});
test('resize corners snap; connector bindings take priority over the grid', () => {
  assert.deepEqual(gestureOperations(gesture([rect], 'resize'), { x: 10, y: 10 }, 1),
    [{ kind: 'update', id: 'r', patch: { width: 59, height: 55 } }]);
  const arrow = objectSchema.parse({ id: 'a', type: 'arrow', x: 0, y: 0, x2: 50, y2: 50 });
  const current = gesture([arrow], 'end'); current.scene = [arrow, rect];
  assert.deepEqual(gestureOperations(current, { x: 13, y: -9 }, 1), [{ kind: 'update', id: 'a',
    patch: { x2: 61, y2: 41, endBinding: { objectId: 'r', anchor: 'right' } } }]);
});
