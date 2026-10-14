import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Desk, objectSchema, dispatch } from '../src/model';
import { reactions } from '../src/reaction-values';
import { reactionOperations } from '../src/reactions';

const rect = (id: string) => objectSchema.parse({ id, type: 'rect' });

test('six unique reactions are optional, validated and updated atomically with shared Undo', () => {
  assert.equal(rect('legacy').reactions, undefined);
  assert.deepEqual(objectSchema.parse({ id: 'all', type: 'text', reactions: [...reactions] }).reactions, reactions);
  for (const invalid of [['🔥'], ['👍', '👍'], [...reactions, '👍'], '👍', null]) {
    assert.equal(objectSchema.safeParse({ id: 'bad', type: 'rect', reactions: invalid }).success, false);
  }
  const desk = new Desk(); desk.execute({ operations: [{ kind: 'add', object: rect('a') }] });
  dispatch(desk, { method: 'execute', actor: 'agent', expectedRevision: 1,
    operations: [{ kind: 'update', id: 'a', patch: { reactions: ['💡', '✅'] } }] });
  assert.deepEqual(desk.get('a').reactions, ['💡', '✅']);
  assert.equal(desk.revision, 2); desk.undo('human'); assert.equal(desk.get('a').reactions, undefined);
  desk.redo('human'); assert.deepEqual(desk.get('a').reactions, ['💡', '✅']);
  const before = desk.snapshot(), revision = desk.revision;
  assert.throws(() => dispatch(desk, { method: 'execute', operations: [
    { kind: 'update', id: 'a', patch: { x: 999 } },
    { kind: 'update', id: 'a', patch: { reactions: ['✅', '✅'] } },
  ] }));
  assert.deepEqual(desk.snapshot(), before); assert.equal(desk.revision, revision);
  assert.throws(() => desk.execute({ expectedRevision: 1, operations: [{ kind: 'update', id: 'a', patch: { reactions: [] } }] }), /Revision conflict/);
  desk.execute({ operations: [{ kind: 'update', id: 'a', patch: { reactions: [] } }] });
  assert.deepEqual(desk.get('a').reactions, []);
});

test('pins own reactions individually without changing shared style, geometry or bindings', () => {
  const desk = new Desk(); desk.execute({ operations: [
    { kind: 'label_add', id: 'a', seriesId: 'series-1', x: 10, y: 20 },
    { kind: 'label_add', id: 'b', seriesId: 'series-1', x: 200, y: 20 },
    { kind: 'add', object: { id: 'edge', type: 'arrow', startBinding: { objectId: 'a', anchor: 'right' } } },
  ] });
  const before = desk.get('a'), edge = desk.get('edge');
  desk.execute({ operations: [{ kind: 'update', id: 'a', patch: { reactions: ['❤️'] } }] });
  assert.deepEqual(desk.get('a'), { ...before, reactions: ['❤️'] });
  assert.deepEqual(desk.get('edge'), edge); assert.equal(desk.get('b').reactions, undefined);
  desk.execute({ operations: [{ kind: 'series_update', id: 'series-1', patch: { fill: '#ff0000' } }] });
  assert.deepEqual(desk.get('a').reactions, ['❤️']);
  assert.throws(() => desk.execute({ operations: [{ kind: 'update', id: 'a', patch: { reactions: ['👍'], fill: '#ffffff' } }] }));
  assert.deepEqual(desk.get('a').reactions, ['❤️']);
});

test('reaction arrays in context, lists and history cannot mutate committed state or Undo', () => {
  const desk = new Desk(); desk.execute({ operations: [{ kind: 'add', object: { ...rect('a'), reactions: ['👍'] } }] });
  desk.list()[0].reactions!.push('✅');
  desk.getChanges(0).changes[0].details[0].after!.reactions!.push('💡');
  const context = dispatch(desk, { method: 'context' }) as { objects: { reactions: string[] }[] };
  context.objects[0].reactions.length = 0;
  assert.deepEqual(desk.get('a').reactions, ['👍']);
  assert.deepEqual(desk.getChanges(0).changes[0].details[0].after!.reactions, ['👍']);
  desk.undo(); desk.redo(); assert.deepEqual(desk.get('a').reactions, ['👍']);
});

test('multi-selection toggles add only missing reactions and remove from all in one batch', () => {
  const desk = new Desk(); desk.execute({ operations: [
    { kind: 'add', object: { ...rect('a'), reactions: ['👍'] } }, { kind: 'add', object: rect('b') },
  ] });
  const add = reactionOperations(desk.snapshot(), '👍'); assert.equal(add.length, 1);
  desk.execute({ operations: add }); assert.deepEqual(desk.get('b').reactions, ['👍']);
  const remove = reactionOperations(desk.snapshot(), '👍'); assert.equal(remove.length, 2);
  desk.execute({ operations: remove });
  assert.deepEqual(desk.get('a').reactions, []); assert.deepEqual(desk.get('b').reactions, []);
  desk.undo(); assert.ok(desk.snapshot().every(object => object.reactions?.includes('👍')));
  assert.deepEqual(reactionOperations([], '👍'), []);
});
