import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Desk, dispatch, type Batch } from '../src/model.js';
import { formatNumber, formatLimit, seriesSchema } from '../src/settings.js';

const execute = (desk: Desk, operations: Batch['operations']) => desk.execute({ operations, actor: 'human' });
const addLabel = (desk: Desk, id: string, seriesId = 'series-1') => execute(desk, [{ kind: 'label_add', id, seriesId, x: 20, y: 30 }]);

test('creation defaults apply only to new objects and share atomic history', () => {
  const desk = new Desk();
  execute(desk, [{ kind: 'add', object: { id: 'old', type: 'rect' } }]);
  execute(desk, [{ kind: 'defaults_update', patch: { fill: '#f00', textColor: '#0f0', strokeWidth: 7 } },
    { kind: 'update', id: 'old', patch: { strokeWidth: 7 } }]);
  assert.equal(desk.get('old').fill, '#dbeafe');
  assert.equal(desk.get('old').strokeWidth, 7);
  desk.select(['old']);
  assert.equal(desk.settingsSnapshot().defaults.fill, '#f00');
  execute(desk, [{ kind: 'add', object: { id: 'new', type: 'roundedRect' } },
    { kind: 'add', object: { id: 'text', type: 'text' } },
    { kind: 'add', object: { id: 'explicit', type: 'rect', fill: '#00f' } }]);
  assert.equal(desk.get('new').fill, '#f00');
  assert.equal(desk.get('text').fill, '#0f0');
  assert.equal(desk.get('explicit').fill, '#00f');
  desk.undo(); desk.undo();
  assert.equal(desk.get('old').strokeWidth, 2);
  assert.equal(desk.settingsSnapshot().defaults.fill, '#dbeafe');
  desk.redo();
  assert.equal(desk.get('old').strokeWidth, 7);
  assert.equal(desk.getChanges(1).changes[0].settings?.after.defaults.fill, '#f00');
  const revision = desk.revision;
  execute(desk, [{ kind: 'defaults_update', patch: { fill: '#f00' } }]);
  assert.equal(desk.revision, revision);
});

test('labels keep identity and position while series edits propagate in one Undo', () => {
  const desk = new Desk();
  addLabel(desk, 'a'); addLabel(desk, 'b');
  execute(desk, [{ kind: 'update', id: 'a', patch: { x: 100 } },
    { kind: 'series_update', id: 'series-1', patch: { name: '手順', format: 'upper-alpha', fill: '#f00', shape: 'roundedRect' } }]);
  assert.equal(desk.get('a').text, 'A'); assert.equal(desk.get('b').text, 'B');
  assert.equal(desk.get('a').x, 100); assert.equal(desk.get('b').x, 20);
  assert.equal(desk.get('b').fill, '#f00'); assert.equal(desk.get('a').labelShape, 'roundedRect');
  assert.equal(desk.get('a').number, 1);
  assert.equal(desk.getChanges(2).changes[0].details.length, 2);
  const revision = desk.revision;
  assert.throws(() => execute(desk, [{ kind: 'update', id: 'a', patch: { fill: '#00f' } }]), /series_update/);
  assert.throws(() => execute(desk, [{ kind: 'update', id: 'a', patch: { number: 10 } }]), /series_update/);
  assert.throws(() => execute(desk, [{ kind: 'add', object: { id: 'forged', type: 'label' } }]), /label_add/);
  assert.equal(desk.revision, revision);
  desk.undo(); assert.equal(desk.get('a').text, '1'); assert.equal(desk.get('a').x, 20);
  desk.redo(); assert.equal(desk.get('a').text, 'A');
});

test('next numbers follow current maxima after deletions and Undo, with independent series', () => {
  const desk = new Desk();
  execute(desk, [{ kind: 'series_add', series: { id: 'blue', name: '青数字', textColor: '#00f' } }]);
  addLabel(desk, 'one'); addLabel(desk, 'two'); addLabel(desk, 'blue-one', 'blue');
  assert.equal(desk.get('blue-one').number, 1);
  execute(desk, [{ kind: 'delete', id: 'two' }]);
  addLabel(desk, 'replacement'); assert.equal(desk.get('replacement').number, 2);
  desk.undo(); desk.undo();
  addLabel(desk, 'three'); assert.equal(desk.get('three').number, 3);
  assert.equal(desk.listSettings().series[0].next, 4);
  assert.equal(desk.listSettings().series[1].next, 2);
  assert.equal(desk.get('blue-one').textColor, '#00f');
  const state = dispatch(desk, { method: 'settings' }) as ReturnType<Desk['listSettings']>;
  assert.deepEqual(state.series.map(series => series.id), ['series-1', 'blue']);
});

test('all capped formats repeat their upper bound with separate IDs', () => {
  const expected = { 'lower-alpha': 'z', 'upper-alpha': 'Z', 'lower-roman': 'xx', 'upper-roman': 'XX', circled: '⑳', katakana: 'ン' } as const;
  for (const [format, finalText] of Object.entries(expected)) {
    const series = seriesSchema.parse({ id: 'test', name: format, format });
    const desk = new Desk();
    execute(desk, [{ kind: 'series_add', series }]);
    execute(desk, Array.from({ length: formatLimit(series.format) + 2 }, (_, index) => ({
      kind: 'label_add' as const, id: `l${index}`, seriesId: series.id, x: index, y: 0,
    })));
    const last = desk.snapshot().slice(-3);
    assert.deepEqual(last.map(label => label.text), [finalText, finalText, finalText]);
    assert.equal(new Set(last.map(label => label.id)).size, 3);
    assert.equal(desk.listSettings().series[1].nextText, finalText);
  }
  assert.equal(formatNumber('katakana', 45), 'ヲ');
  assert.equal(formatNumber('decimal', 12345), '12345');
});

test('series changes and label creation roll back completely when a batch fails', () => {
  const desk = new Desk();
  assert.throws(() => execute(desk, [{ kind: 'series_add', series: { id: 'new', name: '新規' } },
    { kind: 'label_add', id: 'l', seriesId: 'new', x: 0, y: 0 }, { kind: 'delete', id: 'missing' }]));
  assert.equal(desk.revision, 0); assert.equal(desk.snapshot().length, 0);
  assert.equal(desk.settingsSnapshot().series.length, 1);
  execute(desk, [{ kind: 'series_add', series: { id: 'new', name: '新規' } },
    { kind: 'label_add', id: 'l', seriesId: 'new', x: 0, y: 0 }]);
  desk.undo(); assert.equal(desk.settingsSnapshot().series.length, 1);
  desk.redo(); assert.equal(desk.get('l').text, '1');
});

test('rounded rectangles and shaped labels support connections and shared dimension changes', () => {
  const desk = new Desk();
  execute(desk, [{ kind: 'add', object: { id: 'r', type: 'roundedRect', x: 100, y: 100 } },
    { kind: 'series_update', id: 'series-1', patch: { shape: 'ellipse' } },
    { kind: 'label_add', id: 'l', seriesId: 'series-1', x: 400, y: 100 },
    { kind: 'add', object: { id: 'c', type: 'arrow', startBinding: { objectId: 'r', anchor: 'right' },
      endBinding: { objectId: 'l', anchor: 'left' } } }]);
  assert.equal(desk.get('c').x, 280); assert.equal(desk.get('c').x2, 400);
  execute(desk, [{ kind: 'series_update', id: 'series-1', patch: { height: 80 } }]);
  assert.equal(desk.get('c').y2, 140);
  desk.undo(); assert.equal(desk.get('c').y2, 124);
  execute(desk, [{ kind: 'series_update', id: 'series-1', patch: { shape: 'text' } }]);
  assert.equal(desk.get('c').endBinding, null);
});
