import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Desk } from '../src/model';
import { anchorsFor, anchorPoint, snap } from '../src/geometry';
import { snapPinAttachment } from '../src/pin-attachments';
import { encodeDeskFile, decodeDeskFile } from '../src/desk-file';

for (const type of ['image', 'svg', 'mermaid'] as const) test(`${type} outer card anchors support lines, pins and callouts through resize, save, Undo and deletion`, async () => {
  const desk = new Desk();
  desk.execute({ operations: [
    { kind: 'add', object: { id: 'media', type, x: 100, y: 200, width: 300, height: 240,
      ...(type === 'mermaid' ? { mermaidSource: 'flowchart LR; A-->B' } : { src: 'data:image/svg+xml;base64,PHN2Zy8+' }) } },
    { kind: 'label_add', id: 'pin', seriesId: 'series-1', x: 0, y: 0 },
    { kind: 'update', id: 'pin', patch: { attachment: { objectId: 'media', anchor: 'top-left' } } },
    { kind: 'add', object: { id: 'line', type: 'line', x: 0, y: 0, x2: 0, y2: 0, endBinding: { objectId: 'media', anchor: 'right' } } },
    { kind: 'add', object: { id: 'comment', type: 'text', callout: { x: 0, y: 0, binding: { objectId: 'media', anchor: 'bottom-right' } } } },
  ] });
  assert.equal(anchorsFor(desk.get('media')).length, 8);
  for (const anchor of anchorsFor(desk.get('media'))) {
    const point = anchorPoint(desk.get('media'), anchor);
    assert.deepEqual(snap(point, [desk.get('media')], 1)?.binding, { objectId: 'media', anchor });
    assert.deepEqual(snapPinAttachment(point, [desk.get('media')], 1)?.binding, { objectId: 'media', anchor });
  }
  desk.execute({ operations: [{ kind: 'update', id: 'media', patch: { x: 200, y: 300, width: 500, height: 400 } }] });
  assert.deepEqual({ x: desk.get('line').x2, y: desk.get('line').y2 }, { x: 700, y: 500 });
  assert.equal(desk.get('pin').x + desk.get('pin').width / 2, 200);
  assert.equal(desk.get('pin').y + desk.get('pin').height, 300);
  assert.equal(desk.get('comment').callout?.x, 700); assert.equal(desk.get('comment').callout?.y, 700);
  const saved = await decodeDeskFile(await encodeDeskFile(desk)); const restored = new Desk(); restored.replaceDocument({ objects: saved.objects, settings: saved.settings });
  assert.deepEqual(restored.list(), desk.list());
  desk.undo(); assert.equal(desk.get('line').x2, 400); desk.redo(); assert.equal(desk.get('line').x2, 700);
  desk.execute({ operations: [{ kind: 'delete', id: 'media' }] });
  assert.equal(desk.get('line').endBinding, null); assert.equal(desk.get('pin').attachment, null);
  assert.equal(desk.get('comment').callout?.binding, null); assert.equal(desk.get('line').x2, 700);
});
