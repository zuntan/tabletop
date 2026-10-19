import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Desk } from '../src/model';
import { gestureOperations, gesturePreview, type Gesture } from '../src/diagram-gestures';
import { encodeDeskFile, decodeDeskFile } from '../src/desk-file';
import { PartClipboard } from '../src/part-clipboard';

function fixture() {
  const desk = new Desk();
  desk.execute({ operations: [
    { kind: 'add', object: { id: 'card', type: 'text', x: 100, y: 100, width: 200, height: 100 } },
    { kind: 'label_add', id: 'pin', seriesId: 'series-1', x: 0, y: 0 },
    { kind: 'label_add', id: 'other', seriesId: 'series-1', x: 500, y: 400 },
  ] });
  return desk;
}
function drag(desk: Desk, ids: string[], x: number, y: number, detach = false) {
  const scene = desk.snapshot();
  const gesture: Gesture = { mode: 'move', originals: ids.map(id => desk.get(id)), scene, preview: scene, revision: desk.revision,
    start: { x: 0, y: 0 }, screen: { x: 0, y: 0 }, camera: { x: 0, y: 0 }, additive: [], detach };
  const preview = gesturePreview(gesture, { x, y }, 1);
  desk.execute({ operations: gestureOperations(gesture, { x, y }, 1), snap: 'exact' });
  assert.deepEqual(desk.snapshot(), preview);
}
function attach(desk: Desk) {
  const pin = desk.get('pin');
  drag(desk, ['pin'], 200 - (pin.x + pin.width / 2), 100 - (pin.y + pin.height));
  assert.deepEqual(desk.get('pin').attachment, { objectId: 'card', anchor: 'top' });
}
test('pin tip attaches, follows translation/resize and series dimensions; a bound line follows the pin', () => {
  const desk = fixture(); attach(desk);
  desk.execute({ operations: [{ kind: 'add', object: { id: 'line', type: 'line', x: 0, y: 0, x2: 500, y2: 500, startBinding: { objectId: 'pin', anchor: 'center' } } }] });
  desk.execute({ operations: [{ kind: 'update', id: 'card', patch: { x: 200, width: 300 } }] });
  let pin = desk.get('pin');
  assert.equal(pin.x + pin.width / 2, 350); assert.equal(pin.y + pin.height, 100);
  assert.equal(desk.get('line').x, pin.x + pin.width / 2); assert.equal(desk.get('line').y, pin.y + pin.height / 2);
  desk.execute({ operations: [{ kind: 'series_update', id: 'series-1', patch: { width: 80, height: 100 } }] });
  pin = desk.get('pin'); assert.equal(pin.x + pin.width / 2, 350); assert.equal(pin.y + pin.height, 100);
});
test('pin alone peels off, selected card and pin move once, shape dragging follows locked pins', () => {
  const desk = fixture(); attach(desk);
  const before = desk.snapshot();
  drag(desk, ['pin'], 80, 60);
  assert.equal(desk.get('pin').attachment, null); assert.deepEqual(desk.get('card'), before.find(o => o.id === 'card'));
  desk.undo(); assert.deepEqual(desk.snapshot(), before);
  drag(desk, ['card', 'pin'], 40, 60);
  assert.equal(desk.get('pin').x + desk.get('pin').width / 2, 240);
  assert.equal(desk.get('pin').y + desk.get('pin').height, 160);
  assert.equal(desk.get('pin').attachment?.objectId, 'card');
  desk.execute({ operations: [{ kind: 'update', id: 'pin', patch: { locked: true } }] });
  drag(desk, ['card'], 30, 40);
  assert.equal(desk.get('pin').x + desk.get('pin').width / 2, 270);
});
test('Alt bypasses reattachment, pins and lines cannot be attachment targets, deletion preserves pin', async () => {
  const desk = fixture(); attach(desk);
  drag(desk, ['pin'], 1, 1, true);
  assert.equal(desk.get('pin').attachment, null);
  const before = desk.snapshot();
  for (const target of ['pin', 'other']) assert.throws(() => desk.execute({ operations: [{ kind: 'update', id: 'pin', patch: { attachment: { objectId: target, anchor: 'center' } } }] }));
  assert.deepEqual(desk.snapshot(), before);
  attach(desk);
  const saved = await decodeDeskFile(await encodeDeskFile(desk));
  const restored = new Desk(); restored.replaceDocument({ objects: saved.objects, settings: saved.settings });
  assert.deepEqual(restored.snapshot(), desk.snapshot());
  desk.execute({ operations: [{ kind: 'delete', id: 'card' }] });
  assert.equal(desk.get('pin').attachment, null); assert.equal(desk.get('pin').number, 1);
  desk.undo(); assert.equal(desk.get('pin').attachment?.objectId, 'card');
});
test('copying pin with its target remaps attachment; copying pin alone leaves it free', () => {
  const desk = fixture(); attach(desk);
  const clipboard = new PartClipboard(), values = new Map<string, string>();
  const data = { setData: (key: string, value: string) => { values.set(key, value); }, getData: (key: string) => values.get(key) ?? '' };
  clipboard.write(data, [desk.get('card'), desk.get('pin')]);
  const ids = clipboard.paste(desk);
  assert.equal(desk.get(ids[1]).attachment?.objectId, ids[0]);
  assert.notEqual(desk.get(ids[1]).number, desk.get('pin').number);
  clipboard.write(data, [desk.get('pin')]);
  assert.equal(desk.get(clipboard.paste(desk)[0]).attachment, undefined);
});
