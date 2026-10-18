import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Desk } from '../src/model.js';
import { anchorsFor, anchorPoint, snap } from '../src/geometry.js';

test('individual descriptions preserve series numbers, geometry, bindings and atomic history', () => {
  const desk = new Desk();
  desk.execute({ operations: [
    { kind: 'label_add', id: 'a', seriesId: 'series-1', x: 100, y: 120, description: '最初の説明' },
    { kind: 'label_add', id: 'b', seriesId: 'series-1', x: 200, y: 120 },
    { kind: 'add', object: { id: 'c', type: 'arrow', endBinding: { objectId: 'a', anchor: 'right' } } },
  ] });
  const connector = desk.get('c');
  desk.execute({ operations: [{ kind: 'update', id: 'a', patch: { description: '長い説明\n二行目' } }] });
  assert.equal(desk.get('a').text, '1');
  assert.equal(desk.get('b').description, '');
  assert.deepEqual(desk.get('c'), connector);
  assert.equal(desk.list()[0].description, '長い説明\n二行目');
  desk.undo();
  assert.equal(desk.get('a').description, '最初の説明');
  desk.redo();
  assert.equal(desk.get('a').description, '長い説明\n二行目');
  assert.throws(() => desk.execute({ operations: [{ kind: 'update', id: 'a', patch: { text: 'forged' } }] }));
});

test('every label frame exposes one center connection', () => {
  const desk = new Desk();
  desk.execute({ operations: [{ kind: 'label_add', id: 'a', seriesId: 'series-1', x: 100, y: 120 }] });
  for (const shape of ['text', 'rect', 'roundedRect', 'ellipse', 'pin'] as const) {
    desk.execute({ operations: [{ kind: 'series_update', id: 'series-1', patch: { shape } }] });
    for (const anchor of anchorsFor(desk.get('a'))) {
      const point = anchorPoint(desk.get('a'), anchor);
      assert.deepEqual(snap(point, desk.snapshot(), 1)?.binding, { objectId: 'a', anchor });
    }
  }
});

test('new series inherit current defaults once, including MCP creation', () => {
  const desk = new Desk();
  desk.execute({ operations: [
    { kind: 'defaults_update', patch: { fontSize: 32, textColor: '#f00', fill: '#fff' } },
    { kind: 'series_add', series: { id: 'new', name: '新規' } },
    { kind: 'defaults_update', patch: { fontSize: 16, textColor: '#00f' } },
  ] });
  const series = desk.settingsSnapshot().series[1];
  assert.equal(series.fontSize, 32); assert.equal(series.textColor, '#f00'); assert.equal(series.fill, '#fff');
});
