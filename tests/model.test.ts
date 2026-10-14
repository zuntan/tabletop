import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Desk, dispatch, objectSchema } from '../src/model.js';

const rect = (id: string, x = 0) => objectSchema.parse({ id, type: 'rect', x });
test('human and agent share undo history and revisions never roll back', () => {
  const desk = new Desk();
  desk.execute({ actor: 'human', operations: [{ kind: 'add', object: rect('a') }] });
  dispatch(desk, { method: 'execute', actor: 'agent-01', operations: [{ kind: 'update', id: 'a', patch: { x: 50 } }] });
  desk.undo('human');
  assert.equal(desk.get('a').x, 0);
  assert.equal(desk.revision, 3);
  desk.redo('agent-02');
  assert.equal(desk.get('a').x, 50);
  assert.equal(desk.revision, 4);
  assert.deepEqual(desk.getChanges(0).changes.map(c => c.actor), ['human', 'agent-01', 'human', 'agent-02']);
  assert.deepEqual(desk.getChanges(0).changes.map(c => c.operation), ['batch', 'batch', 'undo', 'redo']);
});
test('batches are atomic, grouped, and reject duplicate or missing IDs', () => {
  const desk = new Desk();
  assert.throws(() => desk.execute({ operations: [{ kind: 'add', object: rect('a') }, { kind: 'delete', id: 'missing' }] }));
  assert.equal(desk.summary().count, 0);
  assert.equal(desk.revision, 0);
  desk.execute({ operations: [{ kind: 'add', object: rect('a') }, { kind: 'add', object: rect('b') }] });
  assert.equal(desk.revision, 1);
  assert.throws(() => desk.execute({ operations: [{ kind: 'add', object: rect('a') }] }));
  desk.undo();
  assert.equal(desk.summary().count, 0);
});
test('selection is independent, cleaned after deletion, and snapshots are isolated', () => {
  const desk = new Desk();
  desk.execute({ operations: [{ kind: 'add', object: rect('a') }] });
  desk.select(['a', 'a']);
  assert.deepEqual(desk.selected(), ['a']);
  assert.equal(desk.revision, 1);
  const snapshot = desk.snapshot(); snapshot[0].x = 999;
  assert.equal(desk.get('a').x, 0);
  assert.throws(() => desk.select(['bad']));
  desk.execute({ operations: [{ kind: 'delete', id: 'a' }] });
  assert.deepEqual(desk.selected(), []);
  assert.equal(desk.getChanges(1).changes[0].details[0].before?.id, 'a');
});
test('no-op does not advance revision; a new edit invalidates redo', () => {
  const desk = new Desk();
  desk.execute({ operations: [{ kind: 'add', object: rect('a') }] });
  desk.execute({ operations: [{ kind: 'update', id: 'a', patch: { x: 0 } }] });
  assert.equal(desk.revision, 1);
  desk.undo();
  desk.execute({ operations: [{ kind: 'add', object: rect('b') }] });
  assert.throws(() => desk.redo());
});
test('revision guards and paging', () => {
  const desk = new Desk();
  desk.execute({ operations: [{ kind: 'add', object: rect('a') }] });
  assert.throws(() => desk.execute({ expectedRevision: 0, operations: [{ kind: 'delete', id: 'a' }] }));
  desk.execute({ expectedRevision: 1, operations: [{ kind: 'update', id: 'a', patch: { x: 2 } }] });
  const first = desk.getChanges(0, 1);
  assert.equal(first.nextRevision, 1); assert.equal(first.hasMore, true);
  assert.equal(desk.getChanges(first.nextRevision).changes[0].revision, 2);
  assert.throws(() => desk.getChanges(3));
  assert.throws(() => desk.getChanges(-1));
});
test('reordering is undoable and reports positions', () => {
  const desk = new Desk();
  desk.execute({ operations: [{ kind: 'add', object: rect('a') }, { kind: 'add', object: rect('b') }] });
  desk.execute({ operations: [{ kind: 'reorder', id: 'a', index: 1 }] });
  assert.deepEqual(desk.list().map(o => o.id), ['b', 'a']);
  assert.equal(desk.getChanges(1).changes[0].details.find(d => d.id === 'a')?.afterIndex, 1);
  desk.undo(); assert.deepEqual(desk.list().map(o => o.id), ['a', 'b']);
});
test('asset metadata omits large payloads but detailed retrieval includes it', () => {
  const desk = new Desk();
  const src = 'data:image/png;base64,aGVsbG8=';
  desk.execute({ operations: [{ kind: 'add', object: objectSchema.parse({ id: 'image', type: 'image', src }) }] });
  assert.equal(desk.get('image').src, src);
  assert.equal('src' in desk.list()[0], false);
  assert.equal(JSON.stringify(desk.getChanges(0)).includes(src), false);
});
test('reject unsafe URLs, missing media, invalid geometry, and unexpected properties', () => {
  for (const input of [
    { id: 'a', type: 'link', url: 'javascript:alert(1)' },
    { id: 'a', type: 'image', src: 'data:text/html;base64,aGVsbG8=' },
    { id: 'a', type: 'rect', width: -1 },
    { id: 'a', type: 'rect', fill: 'url(https://evil.example)' },
    { id: 'a', type: 'rect', surprise: true },
  ]) assert.throws(() => objectSchema.parse(input));
  const desk = new Desk();
  assert.throws(() => desk.execute({ operations: [{ kind: 'add', object: objectSchema.parse({ id: 'a', type: 'web' }) }] }));
  assert.throws(() => desk.execute({ operations: [{ kind: 'add', object: objectSchema.parse({ id: 'a', type: 'image' }) }] }));
});
