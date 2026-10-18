import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Desk } from '../src/model.js';
import { pinPath, numberCenterY, tightFrame } from '../src/pin-shape.js';
import { anchorPoint, snap } from '../src/geometry.js';
import { gridOrigin } from '../src/grid.js';

test('new pin series use compact default map pins and inherit font size only at creation', () => {
  const desk = new Desk();
  const initial = desk.settingsSnapshot().series[0];
  assert.equal(initial.shape, 'pin'); assert.equal(initial.width, 36); assert.equal(initial.height, 48);
  desk.execute({ operations: [
    { kind: 'defaults_update', patch: { fontSize: 32 } },
    { kind: 'series_add', series: { id: 'new', name: '大きいピン' } },
    { kind: 'series_add', series: { id: 'custom', name: '既存寸法', shape: 'ellipse', width: 80, height: 70 } },
  ] });
  const series = desk.settingsSnapshot().series;
  assert.equal(series[1].width, 44); assert.equal(series[1].height, 59);
  assert.equal(series[2].width, 80); assert.equal(series[2].height, 70);
  assert.deepEqual(series[0], initial);
});

test('pin path ends at bottom-center, numbers sit in the rounded head and anchors remain fixed', () => {
  assert.match(pinPath(36, 48), /^M 18 48 C /);
  assert.match(pinPath(36, 48), /18 48 Z$/);
  assert.equal(numberCenterY('pin', 48), 18);
  assert.equal(numberCenterY('ellipse', 48), 24);
  const desk = new Desk();
  desk.execute({ operations: [
    { kind: 'label_add', id: 'p', seriesId: 'series-1', x: 100, y: 120 },
    { kind: 'add', object: { id: 'a', type: 'arrow', endBinding: { objectId: 'p', anchor: 'bottom' } } },
  ] });
  const point = { x: 118, y: 168 };
  assert.deepEqual(gridOrigin(desk.get('p')), point);
  assert.deepEqual(anchorPoint(desk.get('p'), 'bottom'), point);
  assert.equal(snap(point, desk.snapshot(), 1), null);
  assert.deepEqual(snap(anchorPoint(desk.get('p'), 'center'), desk.snapshot(), 1)?.binding, { objectId: 'p', anchor: 'center' });
  const before = desk.get('a');
  desk.execute({ operations: [{ kind: 'series_update', id: 'series-1', patch: { shape: 'text' } }] });
  assert.deepEqual(desk.get('a'), before);
  desk.undo(); assert.equal(desk.get('p').labelShape, 'pin');
});

test('tight frame keeps small padding and accounts for wide number formats', () => {
  assert.deepEqual(tightFrame(24, 'pin'), { width: 36, height: 48 });
  assert.deepEqual(tightFrame(24, 'rect'), { width: 36, height: 36 });
  assert.deepEqual(tightFrame(24, 'ellipse', ['ン']), { width: 36, height: 36 });
  assert.ok(tightFrame(24, 'pin', ['123']).width > 36);
  assert.equal(tightFrame(24, 'roundedRect', ['XX'], () => 40).width, 52);
});
