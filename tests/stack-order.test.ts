import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Desk, type DeskObject } from '../src/model';
import { publishObject } from '../src/object-properties';
import { encodeDeskFile, decodeDeskFile } from '../src/desk-file';
import type { StackDirection } from '../src/stack-order';

function fixture() {
  const desk = new Desk();
  desk.execute({ operations: ['a', 'gap', 'b', 'c'].map((id, i) => ({ kind: 'add' as const, object: {
    id, type: 'text' as const, x: id === 'gap' ? 1000 : 0, y: 0, width: 100 + i * 20, height: 100, text: id,
  } })) });
  return desk;
}
function order(desk: Desk, ids: string[], direction: StackDirection, actor = 'human') {
  desk.execute({ actor, operations: [{ kind: 'order', ids, direction }] });
}
const ids = (desk: Desk) => desk.snapshot().map(object => object.id);
function clipped(mode: 'fixed' | 'percent' | 'base-short-side' = 'fixed', anchor: NonNullable<DeskObject['clipAnchor']> = 'top-left') {
  const desk = fixture();
  desk.execute({ operations: [{ kind: 'add', object: { id: 'clip', type: 'clip', clipMembers: ['a', 'b', 'c'], clipAnchor: anchor, clipOffsetMode: mode, clipOffset: 500, clipOffsetPercent: 120, clipAutoSize: true } }] });
  return desk;
}

test('one step crosses the nearest overlapping unselected object, skips gaps and stops at the end', () => {
  const desk = fixture(), before = desk.snapshot();
  order(desk, ['a'], 'forward');
  assert.deepEqual(ids(desk), ['gap', 'b', 'a', 'c']);
  assert.equal(desk.get('a').x, before[0].x);
  desk.undo(); assert.deepEqual(desk.snapshot(), before);
  desk.redo(); assert.deepEqual(ids(desk), ['gap', 'b', 'a', 'c']);
  order(desk, ['a'], 'forward');
  assert.deepEqual(ids(desk), ['gap', 'b', 'c', 'a']);
  const revision = desk.revision;
  order(desk, ['a'], 'forward'); assert.equal(desk.revision, revision);
  order(desk, ['gap'], 'backward'); assert.equal(desk.revision, revision);
});

test('selected objects retain relative order and their mutual overlap is ignored', () => {
  const desk = fixture();
  order(desk, ['c', 'a'], 'forward');
  assert.deepEqual(ids(desk), ['gap', 'b', 'a', 'c']);
  const revision = desk.revision;
  order(desk, ['a', 'c'], 'forward'); assert.equal(desk.revision, revision);
  order(desk, ['a', 'c'], 'back'); assert.deepEqual(ids(desk), ['a', 'c', 'gap', 'b']);
  order(desk, ['c', 'a'], 'front'); assert.deepEqual(ids(desk), ['gap', 'b', 'a', 'c']);
});

for (const mode of ['fixed', 'percent', 'base-short-side'] as const) {
  for (const anchor of ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top', 'left'] as const) {
    test(`clip paper ordering preserves clip position with ${mode} at ${anchor}`, () => {
      const desk = clipped(mode, anchor), before = desk.snapshot(), clip = desk.get('clip');
      order(desk, ['c'], 'back');
      assert.deepEqual(desk.get('clip').clipMembers, ['c', 'a', 'b']);
      assert.ok(Math.abs(desk.get('clip').x - clip.x) < 1e-8);
      assert.ok(Math.abs(desk.get('clip').y - clip.y) < 1e-8);
      desk.undo(); assert.deepEqual(desk.snapshot(), before);
      desk.redo(); assert.deepEqual(desk.get('clip').clipMembers, ['c', 'a', 'b']);
    });
  }
}

test('paper steps ignore geometric overlap, clip selection suppresses its selected papers', () => {
  const desk = clipped();
  order(desk, ['a'], 'forward'); assert.deepEqual(desk.get('clip').clipMembers, ['b', 'a', 'c']);
  const members = desk.get('clip').clipMembers;
  order(desk, ['clip', 'a', 'c'], 'back');
  assert.deepEqual(desk.get('clip').clipMembers, members);
  assert.deepEqual(ids(desk), ['b', 'a', 'c', 'clip', 'gap']);
});

test('a selected clip and another clips paper affect their own scopes', () => {
  const desk = clipped();
  desk.execute({ operations: [
    { kind: 'add', object: { id: 'other', type: 'text', x: 0, y: 0 } },
    { kind: 'add', object: { id: 'clip2', type: 'clip', clipMembers: ['gap', 'other'] } },
  ] });
  order(desk, ['clip', 'gap'], 'front');
  assert.deepEqual(desk.get('clip').clipMembers, ['a', 'b', 'c']);
  assert.deepEqual(desk.get('clip2').clipMembers, ['other', 'gap']);
  assert.deepEqual(ids(desk).slice(-4), ['a', 'b', 'c', 'clip']);
});

test('ruler members move as one layer without changing geometry or internal order', () => {
  const desk = fixture();
  desk.execute({ operations: [{ kind: 'add', object: { id: 'ruler', type: 'ruler', x: 0, y: 0, width: 36, height: 300, rulerMode: 'free', rulerMembers: [{ id: 'a', side: 'after' }, { id: 'b', side: 'after' }] } }] });
  const before = desk.snapshot();
  order(desk, ['b', 'ruler', 'a'], 'front');
  assert.deepEqual(ids(desk).slice(-3), ['a', 'b', 'ruler']);
  for (const object of before) assert.deepEqual(desk.get(object.id), object);
});

test('human locked targets and filed members reject atomically; legacy reorder remains supported', () => {
  const desk = clipped();
  desk.execute({ operations: [{ kind: 'update', id: 'clip', patch: { locked: true } }] });
  const before = desk.snapshot();
  assert.throws(() => order(desk, ['clip'], 'front'), /Unlock/);
  assert.deepEqual(desk.snapshot(), before);
  order(desk, ['clip'], 'front', 'agent');
  desk.execute({ operations: [{ kind: 'update', id: 'clip', patch: { locked: false } }, { kind: 'add', object: { id: 'file', type: 'file', x: -50, y: -50, width: 2000, height: 2000, fileMembers: ['a', 'b', 'c', 'clip'] } }] });
  assert.throws(() => order(desk, ['a'], 'front', 'agent'));
  desk.execute({ operations: [{ kind: 'reorder', id: 'file', index: 0 }] });
  assert.equal(ids(desk)[0], 'file');
});

test('ordered paper state survives the existing desk file format', async () => {
  const desk = clipped();
  order(desk, ['c'], 'back');
  const decoded = await decodeDeskFile(await encodeDeskFile(desk));
  const restored = new Desk(); restored.replaceDocument({ objects: decoded.objects, settings: decoded.settings });
  assert.deepEqual(restored.snapshot().map(publishObject), desk.snapshot().map(publishObject));
});
