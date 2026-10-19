import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Desk, objectSchema } from '../src/model';
import { calloutPath, thoughtBubbles, leaderGeometry } from '../src/text-callouts';
import { gestureOperations, gesturePreview, type Gesture } from '../src/diagram-gestures';
import { propertyFieldPatch } from '../src/properties';
import { encodeDeskFile, decodeDeskFile } from '../src/desk-file';
import { PartClipboard } from '../src/part-clipboard';

function fixture() {
  const desk = new Desk();
  desk.execute({ operations: [
    { kind: 'add', object: { id: 'note', type: 'text', x: 0, y: 0, width: 200, height: 100, text: '補足', callout: { x: 300, y: 200 } } },
    { kind: 'add', object: { id: 'card', type: 'rect', x: 400, y: 200, width: 100, height: 100 } },
  ] }); return desk;
}
function drag(desk: Desk, mode: 'move' | 'callout', dx: number, dy: number, alt = false) {
  const scene = desk.snapshot();
  const g: Gesture = { mode, scene, preview: scene, originals: [desk.get('note')], start: { x: 0, y: 0 }, screen: { x: 0, y: 0 },
    camera: { x: 0, y: 0 }, revision: desk.revision, additive: [], detach: alt };
  const preview = gesturePreview(g, { x: dx, y: dy }, 1);
  desk.execute({ operations: gestureOperations(g, { x: dx, y: dy }, 1) }); assert.deepEqual(desk.snapshot(), preview);
}
test('callout enable/disable changes only its decoration; root auto-selects all edges safely', () => {
  const desk = fixture(), object = desk.get('note');
  assert.deepEqual(propertyFieldPatch('calloutMode', 'none', object), { callout: null });
  for (const point of [{ x: 100, y: -80 }, { x: 300, y: 50 }, { x: 100, y: 200 }, { x: -80, y: 50 }, { x: 100, y: 50 }]) {
    const path = calloutPath({ ...object, callout: point });
    assert.match(path, /^M/); assert.match(path, /Z$/); assert.doesNotMatch(path, /NaN|Infinity/);
    if (point.x < 0 || point.y < 0 || point.x > 200 || point.y > 100) assert.ok(path.includes('L' + point.x + ',' + point.y));
  }
  assert.doesNotMatch(calloutPath(objectSchema.parse({ id: 'tiny', type: 'text', width: 1, height: 1, callout: { x: 50, y: 30 } })), /NaN|Infinity/);
});
test('tip attaches and follows target resizing; body moves independently; Alt detaches only tip', () => {
  const desk = fixture(); drag(desk, 'callout', 100, 50);
  assert.deepEqual(desk.get('note').callout?.binding, { objectId: 'card', anchor: 'left' });
  desk.execute({ operations: [{ kind: 'update', id: 'card', patch: { x: 500, height: 200 } }] });
  assert.equal(desk.get('note').callout?.x, 500); assert.equal(desk.get('note').callout?.y, 300);
  drag(desk, 'move', 40, 50);
  assert.equal(desk.get('note').x, 40); assert.equal(desk.get('note').callout?.x, 500);
  const before = desk.snapshot(); drag(desk, 'callout', 50, 60, true);
  assert.equal(desk.get('note').callout?.binding, null);
  desk.undo(); assert.deepEqual(desk.snapshot(), before);
});
test('free tail translates with the body; target deletion keeps the tail in place; save/copy preserve semantics', async () => {
  const desk = fixture(); drag(desk, 'move', 30, 40);
  assert.equal(desk.get('note').callout?.x, 330); assert.equal(desk.get('note').callout?.y, 240);
  desk.execute({ operations: [{ kind: 'update', id: 'note', patch: { callout: { x: 0, y: 0, binding: { objectId: 'card', anchor: 'left' } } } }] });
  const saved = await decodeDeskFile(await encodeDeskFile(desk));
  const restored = new Desk(); restored.replaceDocument({ objects: saved.objects, settings: saved.settings });
  assert.deepEqual(restored.snapshot(), desk.snapshot());
  const clipboard = new PartClipboard(), values = new Map<string, string>();
  clipboard.write({ setData: (k, v) => { values.set(k, v); }, getData: k => values.get(k) ?? '' }, [desk.get('note'), desk.get('card')]);
  const ids = clipboard.paste(desk);
  assert.equal(desk.get(ids[0]).callout?.binding?.objectId, ids[1]);
  desk.execute({ operations: [{ kind: 'delete', id: 'card' }] });
  assert.equal(desk.get('note').callout?.binding, null); assert.equal(desk.get('note').callout?.x, 400);
  desk.undo(); assert.equal(desk.get('note').callout?.binding?.objectId, 'card');
});

test('thought bubbles retain distinct circles and a tip gap; short tails reduce count instead of crushing', () => {
  const base = objectSchema.parse({ id: 'thought', type: 'text', width: 240, height: 120, strokeWidth: 2,
    callout: { x: 120, y: 260, style: 'thought' } });
  const circles = thoughtBubbles(base);
  assert.equal(circles.length, 3);
  assert.ok(Math.abs(circles[0].y - (120 + 140/6)) < 1e-9);
  assert.ok(Math.abs(circles[1].y - 190) < 1e-9);
  assert.ok(Math.abs(circles[2].y - (120 + 140*5/6)) < 1e-9);
  assert.ok(circles[0].radius > circles[1].radius && circles[1].radius > circles[2].radius);
  for (let i = 0; i < circles.length; i++) {
    const circle = circles[i];
    assert.ok(circle.radius >= 5); assert.ok(circle.y + circle.radius < 260);
    if (i) assert.ok(Math.hypot(circle.x - circles[i-1].x, circle.y - circles[i-1].y) > circle.radius + circles[i-1].radius);
  }
  assert.equal((calloutPath(base).match(/ a/g) ?? []).length, 6);
  for (const length of [0, 1, 10, 25, 50, 80]) {
    const object = { ...base, callout: { x: 120, y: 120 + length, style: 'thought' as const } };
    assert.doesNotMatch(calloutPath(object), /NaN|Infinity/);
    assert.ok(thoughtBubbles(object).every(circle => circle.radius >= 5));
  }
  const bound = { ...base, callout: { ...base.callout!, binding: { objectId: 'target', anchor: 'left' as const } } };
  const patch = propertyFieldPatch('calloutMode', 'speech', bound);
  assert.equal(patch.callout?.style, 'speech'); assert.deepEqual(patch.callout?.binding, bound.callout.binding);
  assert.equal(patch.callout?.x, bound.callout.x);
});

test('leader has an outward stub and preserves bindings on style changes', () => {
  const object = objectSchema.parse({ id: 'leader', type: 'text', width: 240, height: 120,
    callout: { x: -80, y: 200, style: 'leader', binding: { objectId: 'target', anchor: 'left' } } });
  const geometry = leaderGeometry(object)!;
  assert.deepEqual(geometry.tip, { x: -80, y: 200 });
  assert.ok(geometry.knee.x <= geometry.root.x); assert.ok(geometry.knee.x > geometry.tip.x);
  assert.doesNotMatch(calloutPath(object), / L/);
  const patch = propertyFieldPatch('calloutMode', 'thought', object);
  assert.equal(patch.callout?.style, 'thought'); assert.deepEqual(patch.callout?.binding, object.callout?.binding);
  assert.equal(leaderGeometry({ ...object, callout: { x: 100, y: 60, style: 'leader' } }), null);
});
