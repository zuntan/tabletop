import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Desk, dispatch, objectSchema } from '../src/model';
import { lockOperations, lockSelectionState } from '../src/object-lock';
import { gestureOperations, gesturePreview, type Gesture } from '../src/diagram-gestures';
import { encodeDeskFile, decodeDeskFile } from '../src/desk-file';

function fixture() {
  const desk = new Desk();
  desk.execute({ operations: [
    { kind: 'add', object: { id: 'a', type: 'rect', x: 0, y: 0 } },
    { kind: 'add', object: { id: 'b', type: 'text', x: 300, y: 0 } },
    { kind: 'series_add', series: { id: 's', name: 'Pins' } },
    { kind: 'label_add', id: 'pin', seriesId: 's', x: 100, y: 200 },
  ] });
  return desk;
}

test('AI locks only its explicit pointing set atomically; selection, geometry and settings stay independent', () => {
  const desk = fixture(); desk.select(['b']); desk.point(['a', 'pin']);
  const before = desk.snapshot(), settings = desk.settingsSnapshot(), revision = desk.revision;
  const result = dispatch(desk, { method: 'lock', locked: true, expectedRevision: revision }) as { ids: string[] };
  assert.deepEqual(result.ids, ['a', 'pin']); assert.equal(desk.revision, revision + 1);
  assert.equal(desk.get('a').locked, true); assert.equal(desk.get('pin').locked, true); assert.equal(desk.get('b').locked, undefined);
  assert.deepEqual(desk.selected(), ['b']); assert.deepEqual(desk.pointed(), ['a', 'pin']); assert.deepEqual(desk.settingsSnapshot(), settings);
  assert.deepEqual(desk.snapshot().map(({ locked: _locked, ...object }) => object), before);
  dispatch(desk, { method: 'lock', locked: true }); assert.equal(desk.revision, revision + 1);
  desk.undo(); assert.deepEqual(desk.snapshot(), before); desk.redo(); assert.equal(desk.get('pin').locked, true);
  dispatch(desk, { method: 'lock', locked: false }); assert.equal(desk.get('a').locked, false);
});

test('empty, oversize, stale and invalid lock requests never partially change the desk', () => {
  const desk = fixture(); desk.select(['a']); const before = desk.snapshot(), revision = desk.revision;
  assert.throws(() => dispatch(desk, { method: 'lock', locked: true }), /No lock targets/);
  desk.point(['a']);
  assert.throws(() => dispatch(desk, { method: 'lock', locked: true, expectedRevision: revision - 1 }), /Revision conflict/);
  for (const input of [{ method: 'lock' }, { method: 'lock', locked: 'true' }, { method: 'lock', locked: true, ids: ['b'] }]) assert.throws(() => dispatch(desk, input));
  assert.throws(() => lockOperations(Array.from({ length: 201 }, (_, i) => objectSchema.parse({ id: String(i), type: 'rect' })), true), /200/);
  assert.deepEqual(desk.snapshot(), before); assert.equal(desk.revision, revision);
  assert.equal(objectSchema.safeParse({ id: 'x', type: 'rect', locked: 'yes' }).success, false);
});

test('lock is pointer-only, never an AI permission boundary; pin locks survive series changes', () => {
  const desk = fixture(); desk.point(['a', 'pin']); dispatch(desk, { method: 'lock', locked: true });
  desk.execute({ operations: [
    { kind: 'update', id: 'a', patch: { x: 200, width: 250, text: 'Still editable' } },
    { kind: 'update', id: 'pin', patch: { x: 500 } },
    { kind: 'series_update', id: 's', patch: { fill: '#ff0000' } },
  ] });
  assert.equal(desk.get('a').x, 200); assert.equal(desk.get('a').locked, true);
  assert.equal(desk.get('pin').x, 500); assert.equal(desk.get('pin').locked, true); assert.equal(desk.get('pin').fill, '#ff0000');
  desk.execute({ operations: [{ kind: 'delete', id: 'a' }] }); assert.throws(() => desk.get('a'));
});

test('mouse gestures exclude locked objects for movement, resizing and endpoints including mixed snapped groups', () => {
  const locked = objectSchema.parse({ id: 'locked', type: 'rect', locked: true, x: 1, y: 1 });
  const free = objectSchema.parse({ id: 'free', type: 'rect', x: 24, y: 24 });
  const scene = [locked, free];
  const gesture: Gesture = { mode: 'move', start: { x: 0, y: 0 }, screen: { x: 0, y: 0 }, originals: scene, scene, preview: scene, revision: 1, camera: { x: 0, y: 0 }, additive: [], grid: true, anchorId: 'locked' };
  const ops = gestureOperations(gesture, { x: 26, y: 26 }, 1);
  assert.deepEqual(ops, [{ kind: 'update', id: 'free', patch: { x: 48, y: 48 } }]);
  assert.deepEqual(gesturePreview(gesture, { x: 26, y: 26 }, 1)[0], locked);
  for (const mode of ['move', 'resize', 'start', 'end'] as const) {
    assert.deepEqual(gestureOperations({ ...gesture, mode, originals: [locked] }, { x: 200, y: 200 }, 1), []);
  }
  const connector = objectSchema.parse({ id: 'line', type: 'arrow', x: 100, y: 100, x2: -100, y2: 50, locked: true });
  for (const mode of ['start', 'end', 'move'] as const) assert.deepEqual(gestureOperations({ ...gesture, mode, originals: [connector] }, { x: 30, y: 30 }, 1), []);
});

test('mouse lock round-trips in files, reads/history expose it, legacy files default to unlocked', async () => {
  const desk = fixture(); desk.point(['a', 'pin']); dispatch(desk, { method: 'lock', locked: true });
  const restored = await decodeDeskFile(await encodeDeskFile(desk));
  assert.deepEqual(restored.objects, desk.snapshot());
  const copy = new Desk(); copy.replaceDocument({ objects: restored.objects, settings: restored.settings });
  assert.equal(copy.get('a').locked, true); assert.equal(copy.get('pin').locked, true); assert.equal(!!copy.get('b').locked, false);
  assert.equal(desk.list().find(object => object.id === 'a')!.locked, true);
  assert.equal(desk.getChanges(1).changes[0].details.find(detail => detail.id === 'a')!.after!.locked, true);
});

test('selection toggles support none, all-unlocked, mixed and all-locked without guessing a global target', () => {
  const a = objectSchema.parse({ id: 'a', type: 'rect' }), b = { ...a, id: 'b', locked: true };
  assert.equal(lockSelectionState([]).disabled, true);
  assert.deepEqual(lockSelectionState([a]), { disabled: false, pressed: 'false', nextLocked: true });
  assert.deepEqual(lockSelectionState([a, b]), { disabled: false, pressed: 'mixed', nextLocked: true });
  assert.deepEqual(lockSelectionState([b]), { disabled: false, pressed: 'true', nextLocked: false });
});
