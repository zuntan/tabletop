import assert from 'node:assert/strict';
import { test } from 'node:test';
import { strFromU8, unzipSync } from 'fflate';
import { Desk, dispatch, objectSchema } from '../src/model';
import { publishObject } from '../src/object-properties';
import { encodeDeskFile, decodeDeskFile } from '../src/desk-file';
import { deskContext } from '../src/desk-context';
import { shareRead } from '../src/share-read';

test('line publication has only endpoint/style/connection properties, preserves zeros and does not mutate', () => {
  const line = objectSchema.parse({ id: 'line', type: 'line', x: 0, y: 0, x2: 100, y2: 0,
    fill: '#ff0000', fillOpacity: 0, fontSize: 99, text: 'unused', cornerRadius: 44, padding: 20,
    textFit: 'auto', stroke: '#000000', strokeWidth: 0, startMarker: 'circle', endMarker: 'diamond',
    startJunction: 'junction', reactions: ['👍'], locked: false });
  const before = structuredClone(line), output = publishObject(line);
  assert.deepEqual(line, before);
  for (const key of ['fill','fillOpacity','fontSize','text','textColor','cornerRadius','padding','textFit','width','height'])
    assert.equal(Object.hasOwn(output, key), false, key);
  assert.equal(output.x, 0); assert.equal(output.strokeWidth, 0); assert.equal(output.locked, false);
  assert.equal(output.startMarker, 'circle'); assert.equal(output.endMarker, 'diamond');
  assert.equal(output.startJunction, 'junction'); assert.deepEqual(output.reactions, ['👍']);
});
test('every part kind publishes only its effective appearance/content properties', () => {
  for (const type of ['rect','roundedRect','ellipse','diamond','parallelogram','cylinder','document','cloud','text','image','svg','web','link','label'] as const) {
    const object = objectSchema.parse({ id: type, type, text: 'title', src: 'data:image/png;base64,AA==', url: 'https://example.com/',
      padding: 0, cornerRadius: 0, fillOpacity: 0, fontSize: 24, labelShape: 'pin', seriesId: 'series-1', number: 1 });
    const output = publishObject(object);
    assert.equal(output.type, type);
    if (['image','svg','web','link'].includes(type)) {
      for (const key of ['fill','stroke','fontSize','textColor','cornerRadius','fillOpacity']) assert.equal(Object.hasOwn(output, key), false, type+key);
      assert.equal(output.text, 'title'); assert.equal(output.url, 'https://example.com/');
    } else {
      assert.equal(Object.hasOwn(output, 'src'), false);
      assert.equal(Object.hasOwn(output, 'url'), false);
      assert.equal(output.fillOpacity, 0);
      assert.equal(Object.hasOwn(output,'cornerRadius'), ['roundedRect','text'].includes(type));
      assert.equal(Object.hasOwn(output,'padding'), type === 'text');
    }
  }
});
test('file and all MCP/shared read routes agree; legacy input stays readable and visible data round-trips', async () => {
  const desk = new Desk();
  desk.execute({ operations: [
    { kind: 'add', object: { id: 'shape', type: 'roundedRect', x: 10, y: 20, width: 200, height: 100, fillOpacity: 0, cornerRadius: 0, text: 'keep', textFit: 'shrink' } },
    { kind: 'add', object: { id: 'line', type: 'line', x: 0, y: 0, x2: 400, y2: 200, startBinding: { objectId: 'shape', anchor: 'right' }, strokeWidth: 0, fill: '#ff0000', fontSize: 88 } },
  ] });
  const before = desk.snapshot(), bytes = await encodeDeskFile(desk);
  const manifest = JSON.parse(strFromU8(unzipSync(bytes)['manifest.json']));
  const fileLine = manifest.objects.find((o: { id: string }) => o.id === 'line');
  assert.equal(fileLine.fontSize, undefined); assert.equal(fileLine.fill, undefined); assert.equal(fileLine.width, undefined);
  assert.equal(manifest.objects[0].fillOpacity, 0); assert.equal(manifest.objects[0].cornerRadius, 0);
  const routes = [
    deskContext(desk,0,100).objects.find(o => o.id==='line'),
    (dispatch(desk,{method:'get',id:'line'}) as any),
    (dispatch(desk,{method:'state'}) as any).objects.find((o: any)=>o.id==='line'),
    (shareRead(desk,'desk_get',desk.sessionId,'line') as any),
    desk.getChanges(0).changes[0].details.find(d=>d.id==='line')?.after,
  ];
  for (const line of routes) {
    assert.equal(line.fontSize, undefined); assert.equal(line.fill, undefined); assert.equal(line.strokeWidth,0);
    assert.deepEqual(line.startBinding,{objectId:'shape',anchor:'right'});
  }
  assert.deepEqual(desk.snapshot(),before);
  const decoded = await decodeDeskFile(bytes), restored = new Desk();
  restored.replaceDocument({ objects: decoded.objects, settings: decoded.settings });
  assert.deepEqual(restored.snapshot().map(publishObject), before.map(publishObject));
  // Old documents with irrelevant fields still load; saving them drops only those fields.
  const legacy = new Desk(); legacy.replaceDocument({objects:before,settings:desk.settingsSnapshot()});
  assert.equal((dispatch(legacy,{method:'get',id:'line'}) as any).fontSize,undefined);
});
