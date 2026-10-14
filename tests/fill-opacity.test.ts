import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Desk, objectSchema } from '../src/model';
import { opacityOperations, opacityFromPercent, transparencyPercent } from '../src/fill-opacity';

test('new fills are 70% transparent while explicit/legacy opacity and stroke/text stay independent', () => {
  const desk = new Desk();
  assert.equal(desk.settingsSnapshot().defaults.fillOpacity, 0.3);
  assert.equal(objectSchema.parse({ id: 'legacy', type: 'rect' }).fillOpacity, 1);
  desk.execute({ operations: [
    { kind: 'add', object: { id: 'shape', type: 'rect' } },
    { kind: 'add', object: { id: 'memo', type: 'text', fillOpacity: 0.65 } },
    { kind: 'label_add', id: 'p1', seriesId: 'series-1', x: 0, y: 0 },
    { kind: 'label_add', id: 'p2', seriesId: 'series-1', x: 80, y: 0 },
  ] });
  assert.equal(desk.get('shape').fillOpacity, 0.3); assert.equal(desk.get('p1').fillOpacity, 0.3);
  const operations = opacityOperations(desk.snapshot(), 0.8);
  assert.equal(operations.length, 3);
  desk.execute({ operations });
  for (const object of desk.snapshot()) assert.equal(object.fillOpacity, 0.8);
  assert.equal(desk.get('shape').stroke, '#334155'); assert.equal(desk.get('memo').textColor, '#0f172a');
  desk.undo(); assert.equal(desk.get('shape').fillOpacity, 0.3); assert.equal(desk.get('memo').fillOpacity, 0.65);
  desk.redo(); assert.equal(desk.get('p2').fillOpacity, 0.8);
  for (const fillOpacity of [-0.1, 1.1]) assert.throws(() => desk.execute({ operations: [{ kind: 'update', id: 'shape', patch: { fillOpacity } }] }));
  assert.equal(opacityFromPercent('70'), 0.3); assert.equal(transparencyPercent(0.3), 70);
});
