import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Desk, dispatch, objectSchema } from '../src/model';

test('AI pointing is independent, atomic, isolated and excluded from revisions and Undo', () => {
  const desk = new Desk();
  desk.execute({ operations: ['a', 'b'].map(id => ({ kind: 'add' as const, object: objectSchema.parse({ id, type: 'rect' }) })) });
  desk.select(['a']);
  const before = desk.summary();
  assert.deepEqual(dispatch(desk, { method: 'point', ids: ['b', 'b'] }), { ids: ['b'] });
  assert.deepEqual(desk.selected(), ['a']);
  assert.deepEqual(desk.summary(), before);
  const ids = desk.pointed(); ids.push('a'); assert.deepEqual(desk.pointed(), ['b']);
  assert.throws(() => dispatch(desk, { method: 'point', ids: ['a', 'missing'] }), /Unknown pointing ID/);
  assert.deepEqual(desk.pointed(), ['b']);
  assert.throws(() => dispatch(desk, { method: 'point', ids: Array(2001).fill('a') }));
  for (const method of ['state', 'context', 'selection']) {
    const result = dispatch(desk, { method }) as { aiPointing: string[] };
    assert.deepEqual(result.aiPointing, ['b']);
    result.aiPointing.length = 0; assert.deepEqual(desk.pointed(), ['b']);
  }
  desk.undo(); assert.equal(desk.summary().count, 0); assert.deepEqual(desk.pointed(), []);
  desk.redo(); assert.deepEqual(desk.pointed(), []);
  desk.point(['a', 'b']);
  desk.execute({ operations: [{ kind: 'delete', id: 'b' }] });
  assert.deepEqual(desk.pointed(), ['a']);
  desk.undo(); assert.deepEqual(desk.pointed(), ['a']);
  desk.point([]); assert.deepEqual(desk.pointed(), []);
  assert.deepEqual(desk.selected(), []);
});

test('pointing and clearing preserve redo history', () => {
  const desk = new Desk();
  desk.execute({ operations: [{ kind: 'add', object: objectSchema.parse({ id: 'a', type: 'rect' }) }] });
  desk.execute({ operations: [{ kind: 'update', id: 'a', patch: { x: 100 } }] });
  desk.undo();
  const before = desk.summary(); desk.point(['a']); desk.point([]);
  assert.deepEqual(desk.summary(), before);
  desk.redo(); assert.equal(desk.get('a').x, 100);
});
