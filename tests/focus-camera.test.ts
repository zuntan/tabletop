import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Desk, dispatch, objectSchema } from '../src/model';
import { fittedCamera } from '../src/focus-camera';
import { bounds } from '../src/geometry';
import { labelVisualBounds } from '../src/label-description';

test('fit camera frames negative positions, multiple objects and reversed/degenerate connectors without mutations', () => {
  const objects = [
    objectSchema.parse({ id: 'a', type: 'rect', x: -1000, y: -600, width: 600, height: 400 }),
    objectSchema.parse({ id: 'b', type: 'arrow', x: 1200, y: 700, x2: -400, y2: -200 }),
  ];
  const before = structuredClone(objects);
  const camera = fittedCamera(objects, 1000, 700)!;
  for (const object of objects) {
    const box = bounds(object);
    assert.ok(box.x * camera.zoom + camera.x >= 49.99);
    assert.ok((box.x + box.width) * camera.zoom + camera.x <= 950.01);
    assert.ok(box.y * camera.zoom + camera.y >= 49.99);
    assert.ok((box.y + box.height) * camera.zoom + camera.y <= 620.01);
  }
  assert.deepEqual(objects, before);
  for (const [x2, y2] of [[0, 0], [0, 100], [100, 0]]) {
    const line = objectSchema.parse({ id: 'line', type: 'line', x: 0, y: 0, x2, y2 });
    const fitted = fittedCamera([line], 800, 600)!;
    assert.ok(Object.values(fitted).every(Number.isFinite));
    assert.equal(fitted.zoom, 2);
  }
  assert.equal(fittedCamera([], 800, 600), null);
  assert.equal(fittedCamera(objects, 0, 600), null);
  const small = fittedCamera(objects, 40, 40)!;
  assert.ok(Object.values(small).every(Number.isFinite));
  assert.equal(small.zoom, 0.05);
});

test('fit includes only visible pin descriptions and caps magnification', () => {
  const pin = objectSchema.parse({ id: 'pin', type: 'label', seriesId: 'series-1', number: 1, width: 36, height: 48, description: 'A very long pin description '.repeat(8) });
  const visible = fittedCamera([pin], 800, 600, true)!;
  const hidden = fittedCamera([pin], 800, 600, false)!;
  const box = labelVisualBounds(pin, true);
  assert.ok(visible.zoom < hidden.zoom);
  assert.equal(hidden.zoom, 2);
  assert.ok((box.x + box.width) * visible.zoom + visible.x <= 750.01);
});

test('AI fit target resolution uses only green pointing, with no revision/history/selection change', () => {
  const desk = new Desk();
  desk.execute({ operations: ['human', 'ai'].map(id => ({ kind: 'add', object: objectSchema.parse({ id, type: 'rect' }) })) });
  desk.select(['human']); desk.point(['ai']);
  const before = dispatch(desk, { method: 'state' });
  const target = dispatch(desk, { method: 'fit' }) as { ids: string[] };
  assert.deepEqual(target.ids, ['ai']);
  target.ids.length = 0;
  assert.deepEqual(dispatch(desk, { method: 'state' }), before);
  desk.point([]);
  assert.deepEqual(dispatch(desk, { method: 'fit' }), { ids: [] });
});
