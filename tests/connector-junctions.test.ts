import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Desk, type DeskObject } from '../src/model';
import { gestureOperations, gesturePreview, type Gesture } from '../src/diagram-gestures';
import { encodeDeskFile, decodeDeskFile } from '../src/desk-file';
import { PartClipboard, partClipboardType } from '../src/part-clipboard';

function scene() {
  const desk = new Desk();
  desk.execute({ operations: [
    { kind: 'add', object: { id: 'a', type: 'line', x: 0, y: 0, x2: 100, y2: 0 } },
    { kind: 'add', object: { id: 'b', type: 'line', x: 100, y: 0, x2: 200, y2: 100 } },
    { kind: 'add', object: { id: 'c', type: 'line', x: 300, y: 0, x2: 200, y2: -100 } },
  ] });
  return desk;
}
function gesture(desk: Desk, ids: string[], mode: Gesture['mode'] = 'move', detach = false): Gesture {
  const objects = desk.snapshot();
  return { mode, start: { x: 0, y: 0 }, screen: { x: 0, y: 0 }, scene: objects, preview: objects, originals: ids.map(id => desk.get(id)),
    revision: desk.revision, camera: { x: 0, y: 0 }, additive: [], grid: false, detach };
}
function drag(desk: Desk, ids: string[], mode: Gesture['mode'], x: number, y: number, detach = false) {
  const g = gesture(desk, ids, mode, detach);
  const preview = gesturePreview(g, { x, y }, 1);
  desk.execute({ operations: gestureOperations(g, { x, y }, 1), snap: 'exact' });
  assert.deepEqual(desk.snapshot(), preview);
}
function join(desk: Desk) {
  // Move b start away, then onto a end to join.
  drag(desk, ['b'], 'start', 0, 30);
  drag(desk, ['b'], 'start', 0, -30);
  assert.ok(desk.get('a').endJunction);
  assert.equal(desk.get('a').endJunction, desk.get('b').startJunction);
}
test('symmetric junctions move only joined endpoints, support branching and Alt detach with one Undo', () => {
  const desk = scene(); join(desk);
  // c shares the point too, but b/a group must not snap back to itself.
  drag(desk, ['c'], 'start', -200, 0);
  drag(desk, ['a'], 'end', 30, 20);
  for (const id of ['b', 'c']) { assert.equal(desk.get(id).x, 130); assert.equal(desk.get(id).y, 20); }
  assert.equal(desk.get('b').x2, 200); assert.equal(desk.get('c').y2, -100);
  const before = desk.snapshot();
  drag(desk, ['b'], 'start', 40, 30, true);
  assert.equal(desk.get('b').startJunction, null);
  assert.equal(desk.get('b').x, 170);
  assert.equal(desk.get('a').x2, 130); assert.equal(desk.get('c').x, 130);
  desk.undo(); assert.deepEqual(desk.snapshot(), before);
  desk.redo(); assert.equal(desk.get('b').startJunction, null);
});
test('whole-line/group movement preserves internal joints and peels only shape glue', () => {
  const desk = scene(); join(desk);
  desk.execute({ operations: [
    { kind: 'add', object: { id: 'card', type: 'text', x: 50, y: -50, width: 100, height: 100 } },
    { kind: 'update', id: 'a', patch: { endBinding: { objectId: 'card', anchor: 'top' } } },
  ] });
  desk.execute({ operations: [{ kind: 'update', id: 'card', patch: { x: 70, width: 160 } }] });
  assert.equal(desk.get('b').x, 150); assert.equal(desk.get('b').y, -50);
  const card = desk.get('card');
  drag(desk, ['b'], 'move', 30, 40);
  assert.deepEqual(desk.get('card'), card);
  assert.equal(desk.get('a').endBinding, null);
  assert.equal(desk.get('a').x2, 180); assert.equal(desk.get('b').x, 180);
  assert.equal(desk.get('a').x, 0); assert.equal(desk.get('b').x2, 230);
  drag(desk, ['a', 'b'], 'move', 25, 35);
  assert.equal(desk.get('a').x2, 205); assert.equal(desk.get('b').x, 205);
});
test('selected shape and line move once without dropping their binding', () => {
  const desk = scene();
  desk.execute({ operations: [
    { kind: 'add', object: { id: 'card', type: 'rect', x: 0, y: 0, width: 100, height: 100 } },
    { kind: 'update', id: 'a', patch: { startBinding: { objectId: 'card', anchor: 'right' } } },
  ] });
  drag(desk, ['card', 'a'], 'move', 50, 30);
  assert.equal(desk.get('a').x, 150); assert.equal(desk.get('a').startBinding?.objectId, 'card');
});
test('closed triangle uses independent point groups; deletion detaches only removed line', async () => {
  const desk = new Desk();
  desk.execute({ operations: [
    { kind: 'add', object: { id: 'a', type: 'line', x: 0, y: 0, x2: 100, y2: 0, startJunction: 'ca', endJunction: 'ab' } },
    { kind: 'add', object: { id: 'b', type: 'line', x: 100, y: 0, x2: 50, y2: 100, startJunction: 'ab', endJunction: 'bc' } },
    { kind: 'add', object: { id: 'c', type: 'line', x: 50, y: 100, x2: 0, y2: 0, startJunction: 'bc', endJunction: 'ca' } },
  ] });
  drag(desk, ['a'], 'move', 30, 40);
  assert.equal(desk.get('b').x, 130); assert.equal(desk.get('b').y2, 100);
  assert.equal(desk.get('c').x2, 30); assert.equal(desk.get('c').y, 100);
  const saved = await decodeDeskFile(await encodeDeskFile(desk));
  const restored = new Desk(); restored.replaceDocument({ objects: saved.objects, settings: saved.settings });
  assert.deepEqual(restored.snapshot(), desk.snapshot());
  desk.execute({ operations: [{ kind: 'delete', id: 'a' }] });
  assert.equal(desk.get('b').startJunction, null); assert.equal(desk.get('c').endJunction, null);
  assert.equal(desk.get('b').endJunction, 'bc');
  desk.undo(); assert.equal(desk.get('a').endJunction, 'ab');
});
test('copying joined lines makes independent junction IDs; copying one drops external joint', () => {
  const desk = scene(); join(desk);
  const clipboard = new PartClipboard(), data = new Map<string, string>();
  const transfer = { setData: (type: string, value: string) => { data.set(type, value); }, getData: (type: string) => data.get(type) ?? '' };
  clipboard.write(transfer, ['a', 'b'].map(id => desk.get(id)));
  const copied = clipboard.paste(desk);
  assert.equal(desk.get(copied[0]).endJunction, desk.get(copied[1]).startJunction);
  assert.notEqual(desk.get(copied[0]).endJunction, desk.get('a').endJunction);
  clipboard.write(transfer, [desk.get('a')]); const single = clipboard.paste(desk);
  assert.equal(desk.get(single[0]).endJunction, null);
});

test('merging two existing junctions snaps the whole source group onto the target group', () => {
  const desk = scene(); join(desk);
  desk.execute({ operations: [
    { kind: 'add', object: { id: 'd', type: 'line', x: 400, y: 300, x2: 500, y2: 300, startJunction: 'target' } },
    { kind: 'add', object: { id: 'e', type: 'line', x: 400, y: 300, x2: 500, y2: 400, startJunction: 'target' } },
  ] });
  drag(desk, ['b'], 'start', 300, 300);
  assert.equal(desk.get('a').x2, 400); assert.equal(desk.get('a').y2, 300);
  for (const id of ['b', 'd', 'e']) {
    assert.equal(desk.get(id).x, 400); assert.equal(desk.get(id).y, 300);
    assert.equal(desk.get(id).startJunction, 'target');
  }
});
test('an attachment that would put both ends of a line in the same group simply does not attach', () => {
  const desk = scene(); join(desk);
  drag(desk, ['a'], 'start', 100, 0);
  assert.equal(desk.get('a').startJunction, undefined);
  assert.equal(desk.get('a').endJunction, desk.get('b').startJunction);
});
