import { publishObject } from '../src/object-properties';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Desk, objectSchema } from '../src/model';
import { anchorsFor, anchorPoint } from '../src/geometry';
import { shapePaths, fittedShapeFont, shapeApproximation } from '../src/shape-definitions';
import { encodeDeskFile, decodeDeskFile } from '../src/desk-file';

test('five new shapes share cardinal anchors, text and save/Undo without changing old shapes', async () => {
  const desk = new Desk();
  for (const type of ['diamond', 'parallelogram', 'cylinder', 'document', 'cloud'] as const) {
    desk.execute({ operations: [{ kind: 'add', object: { id: type, type, x: 20, y: 30, width: 200, height: 100, text: '図形', textFit: 'auto' } }] });
    const shape = desk.get(type);
    assert.deepEqual(anchorsFor(shape), ['top', 'right', 'bottom', 'left']);
    assert.deepEqual(anchorPoint(shape, 'top'), { x: 120, y: 30 });
    assert.deepEqual(anchorPoint(shape, 'right'), { x: 220, y: 80 });
    assert.throws(() => anchorPoint(shape, 'top-right'));
    assert.ok(shapePaths(type, 200, 100)?.outline.endsWith('Z'));
    desk.execute({ operations: [
      { kind: 'add', object: { id: type + '-line', type: 'line', x: 0, y: 0, x2: 200, y2: 200, startBinding: { objectId: type, anchor: 'top' } } },
      { kind: 'label_add', id: type + '-pin', seriesId: 'series-1', x: 0, y: 0 },
      { kind: 'update', id: type + '-pin', patch: { attachment: { objectId: type, anchor: 'right' } } },
    ] });
    desk.execute({ operations: [{ kind: 'update', id: type, patch: { width: 300, x: 50 } }] });
    assert.equal(desk.get(type+'-line').x, 200);
    const pin = desk.get(type+'-pin'); assert.equal(pin.x+pin.width/2, 350);
    desk.undo(); assert.equal(desk.get(type).width, 200);
  }
  const saved = await decodeDeskFile(await encodeDeskFile(desk));
  const restored = new Desk(); restored.replaceDocument({ objects: saved.objects, settings: saved.settings });
  assert.deepEqual(restored.snapshot().map(publishObject), desk.snapshot().map(publishObject));
  assert.equal(anchorsFor(objectSchema.parse({ id: 'old', type: 'ellipse' })).length, 8);
});
test('two approximation families and two fit modes enlarge or shrink without changing the requested font', () => {
  const measure = (text: string) => text.length*.6;
  assert.equal(shapeApproximation('diamond'), 'ellipse'); assert.equal(shapeApproximation('cloud'), 'ellipse');
  assert.equal(shapeApproximation('cylinder'), 'rect');
  const auto = fittedShapeFont('rect', 200, 120, 'A', 24, 'auto', measure);
  assert.ok(auto > 24);
  assert.equal(fittedShapeFont('rect', 200, 120, 'A', 24, 'shrink', measure), 24);
  assert.ok(fittedShapeFont('rect', 100, 50, 'Long long long text', 48, 'shrink', measure) < 48);
  assert.equal(fittedShapeFont('rect', 100, 50, 'Long text', 48, undefined, measure), 48);
  assert.equal(fittedShapeFont('diamond', 200, 120, 'A', 24, 'auto', measure), fittedShapeFont('ellipse', 200, 120, 'A', 24, 'auto', measure));
});
