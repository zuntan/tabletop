import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bounds } from '../src/geometry.js';
import { Desk, objectSchema } from '../src/model.js';
import { effectivePinVisibility, pinScreenObject, pinThreadMembers } from '../src/pin-series.js';

test('global and per-series visibility resolve every combination by the more restrictive setting', () => {
  const visibility = ['all', 'pins', 'hidden'] as const;
  const expected = [
    ['all', 'pins', 'hidden'],
    ['pins', 'pins', 'hidden'],
    ['hidden', 'hidden', 'hidden'],
  ];
  for (const [row, global] of visibility.entries()) {
    assert.deepEqual(visibility.map(series => effectivePinVisibility(global, series)), expected[row]);
  }
});

test('screen-sized pin stays anchored at its document bottom-center and bounds scale around that anchor', () => {
  const pin = objectSchema.parse({ id: 'p', type: 'label', seriesId: 'series-1', number: 1,
    x: 120, y: 80, width: 36, height: 48, fontSize: 24, strokeWidth: 2, cornerRadius: 12 });
  const anchor = { x: pin.x + pin.width / 2, y: pin.y + pin.height };
  for (const zoom of [0.5, 1, 2, 4]) {
    const screenPin = pinScreenObject(pin, zoom);
    assert.deepEqual({ x: screenPin.x + screenPin.width / 2, y: screenPin.y + screenPin.height }, anchor);
    assert.equal(screenPin.width, pin.width / zoom);
    assert.equal(screenPin.height, pin.height / zoom);
    const box = bounds(screenPin);
    assert.equal(box.x + box.width / 2, anchor.x);
    assert.equal(box.y + box.height, anchor.y);
  }
});

test('thread members use series number order, while series reorder moves the whole layer block and Undo restores it', () => {
  const desk = new Desk();
  desk.execute({ operations: [
    { kind: 'add', object: { id: 'before', type: 'rect' } },
    { kind: 'label_add', id: 'first', seriesId: 'series-1', x: 0, y: 0 },
    { kind: 'add', object: { id: 'middle', type: 'rect' } },
    { kind: 'label_add', id: 'second', seriesId: 'series-1', x: 20, y: 0 },
    { kind: 'label_add', id: 'third', seriesId: 'series-1', x: 40, y: 0 },
    { kind: 'add', object: { id: 'after', type: 'rect' } },
    { kind: 'series_update', id: 'series-1', patch: { thread: { enabled: true, color: '#f00' } } },
  ] });
  const series = desk.settingsSnapshot().series[0];
  assert.deepEqual(pinThreadMembers([desk.get('third'), desk.get('first'), desk.get('second')], series).map(pin => pin.id),
    ['first', 'second', 'third']);
  desk.execute({ operations: [{ kind: 'series_update', id: 'series-1', patch: { thread: { width: 5 } } }] });
  assert.deepEqual(desk.settingsSnapshot().series[0].thread, { ...series.thread, width: 5 });
  desk.execute({ operations: [{ kind: 'reorder', id: 'second', index: 5 }] });
  const moved = desk.snapshot().map(object => object.id);
  const start = moved.indexOf('first');
  assert.deepEqual(moved.slice(start, start + 3), ['first', 'second', 'third']);
  assert.equal(moved.filter(id => ['first', 'second', 'third'].includes(id)).length, 3);
  desk.undo();
  assert.deepEqual(desk.snapshot().map(object => object.id), ['before', 'first', 'second', 'third', 'middle', 'after']);
});
