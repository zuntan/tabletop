import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Desk, objectSchema, type DeskObject } from '../src/model.js';
import { PartClipboard, partClipboardText, partClipboardType, singleClipboardUrl } from '../src/part-clipboard.js';

class ClipboardMap {
  private values = new Map<string, string>();
  setData(type: string, value: string) { this.values.set(type, value); }
  getData(type: string) { return this.values.get(type) ?? ''; }
}
const part = (object: Partial<DeskObject> & Pick<DeskObject, 'id' | 'type'>) => objectSchema.parse(object);
const copy = (clipboard: PartClipboard, ...objects: DeskObject[]) => {
  const data = new ClipboardMap();
  clipboard.write(data, objects);
  return data;
};

test('copy and repeated paste assign fresh IDs, rebind internal connectors, and leave the source unchanged', () => {
  const source = [
    part({ id: 'box', type: 'rect', x: 10, y: 20, width: 100, height: 60 }),
    part({ id: 'edge', type: 'line', endMarker: 'arrow', x: 110, y: 50, x2: 200, y2: 50,
      startBinding: { objectId: 'box', anchor: 'right' }, endBinding: { objectId: 'outside', anchor: 'left' } }),
  ];
  const original = structuredClone(source);
  const cb = new PartClipboard(); copy(cb, ...source);
  const desk = new Desk();
  const first = cb.paste(desk), second = cb.paste(desk);
  assert.equal(new Set([...first, ...second]).size, 4);
  const firstEdge = desk.get(first[1]), secondEdge = desk.get(second[1]);
  assert.equal(firstEdge.startBinding?.objectId, first[0]);
  assert.equal(firstEdge.endBinding, null);
  assert.equal(secondEdge.startBinding?.objectId, second[0]);
  assert.equal(secondEdge.endBinding, null);
  assert.equal(desk.get(first[0]).x, 34);
  assert.equal(desk.get(second[0]).x, 58);
  assert.deepEqual(source, original);
  desk.undo();
  assert.throws(() => desk.get(second[0]));
  assert.ok(desk.get(first[0]));
});

test('copied labels receive new IDs and series numbers, and paste is undone as one operation', () => {
  const desk = new Desk();
  desk.execute({ operations: [
    { kind: 'label_add', id: 'pin-a', seriesId: 'series-1', x: 1, y: 2 },
    { kind: 'label_add', id: 'pin-b', seriesId: 'series-1', x: 3, y: 4 },
  ] });
  const source = desk.snapshot(); const cb = new PartClipboard(); copy(cb, ...source);
  const ids = cb.paste(desk);
  assert.equal(desk.get(ids[0]).number, 3);
  assert.equal(desk.get(ids[1]).number, 4);
  assert.deepEqual(desk.snapshot().slice(0, 2), source);
  desk.undo();
  assert.deepEqual(desk.snapshot(), source);
});

test('a paste that exceeds the operation cap fails atomically', () => {
  const desk = new Desk();
  desk.execute({ operations: Array.from({ length: 101 }, (_, index) => ({
    kind: 'label_add' as const, id: `pin-${index}`, seriesId: 'series-1', x: index, y: 0,
  })) });
  desk.execute({ operations: Array.from({ length: 101 }, (_, index) => ({
    kind: 'update' as const, id: `pin-${index}`, patch: { locked: true },
  })) });
  const before = desk.snapshot(), revision = desk.revision;
  const cb = new PartClipboard(); copy(cb, ...before);
  assert.throws(() => cb.paste(desk), /200件を超えます/);
  assert.equal(desk.revision, revision);
  assert.deepEqual(desk.snapshot(), before);
});

test('internal identity requires this clipboard token or matching HTML marker', () => {
  const cb = new PartClipboard();
  const data = copy(cb, part({ id: 'a', type: 'text', text: 'same words' }));
  const token = data.getData(partClipboardType);
  assert.equal(cb.matches(token, ''), true);
  assert.equal(cb.matches('', data.getData('text/html')), true);
  assert.equal(cb.matches('', '<pre>same words</pre>'), false);
  assert.equal(cb.matches('foreign-token', '<pre data-tabletop-copy="00000000-0000-0000-0000-000000000000">x</pre>'), false);
});

test('external clipboard text includes text and SVG source while omitting images and connectors', () => {
  const svgSource = '<svg xmlns="http://www.w3.org/2000/svg"><text>図</text></svg>';
  const svgData = `data:image/svg+xml;base64,${Buffer.from(svgSource, 'utf8').toString('base64')}`;
  assert.equal(partClipboardText([
    part({ id: 'shape', type: 'rect', text: '図形の文字' }),
    part({ id: 'pin', type: 'label', text: 'ピン文字' }),
    part({ id: 'arrow', type: 'line', endMarker: 'arrow', text: '除外' }),
    part({ id: 'svg', type: 'svg', src: svgData }),
    part({ id: 'web', type: 'web', text: 'カード', url: 'https://example.test' }),
    part({ id: 'image', type: 'image', src: 'https://example.test/a.png' }),
  ]), `図形の文字\n\nピン文字\n\n${svgSource}\n\nカード\nhttps://example.test`);
  assert.equal(partClipboardText([part({ id: 'remote-svg', type: 'svg', src: 'https://example.test/a.svg' })]), '');
});

test('URL detection accepts one clean HTTP URL and rejects ambiguous or unsafe text', () => {
  assert.equal(singleClipboardUrl('  https://example.test/path?q=1  '), 'https://example.test/path?q=1');
  for (const value of ['', 'hello https://example.test', 'ftp://example.test', 'https://example.test/a b',
    'https://example.test/path,', 'https://example.test\\x', 'https://example.test\nhttps://other.test']) {
    assert.equal(singleClipboardUrl(value), null, value);
  }
});

test('remote paste uses an exact-token snapshot, remaps clip/file references and isolates pin series',()=>{
 const source=new Desk();source.execute({operations:[
  {kind:'series_update',id:'series-1',patch:{fill:'#ff0000',fontSize:32,name:'red pins'}},
  {kind:'add',object:{id:'a',type:'text',x:10,y:20,text:'A',stamp:{designId:'done_ja',text:'fixed',angle:-3}}},
  {kind:'add',object:{id:'b',type:'text',x:30,y:40,text:'B'}},
  {kind:'add',object:{id:'c',type:'clip',clipMembers:['a','b']}},
  {kind:'add',object:{id:'folder',type:'file',text:'Folder',x:-100,y:-100,width:1000,height:1000,fileMembers:['a','b','c']}},
  {kind:'label_add',id:'p',seriesId:'series-1',x:60,y:70},
  {kind:'update',id:'p',patch:{attachment:{objectId:'a',anchor:'top'}}},
 ]});
 const cb=new PartClipboard(),data=new ClipboardMap();cb.write(data,source.snapshot(),source.settingsSnapshot().series);
 const token=data.getData(partClipboardType),snapshot=cb.export(token)!;assert.ok(snapshot);assert.equal(cb.export(crypto.randomUUID()),null);
 const original=structuredClone(snapshot),destination=new Desk(),defaults=destination.settingsSnapshot().series;
 const ids=new PartClipboard().pasteRemote(destination,snapshot,token,{x:100,y:200});
 const objects=ids.map(id=>destination.get(id)),clip=objects.find(o=>o.type==='clip')!,pin=objects.find(o=>o.type==='label')!;
 assert.deepEqual(clip.clipMembers,objects.filter(o=>o.type==='text').map(o=>o.id));
 assert.equal(pin.attachment?.objectId,objects.find(o=>o.text==='A')!.id);
 assert.deepEqual(objects.find(o=>o.type==='file')!.fileMembers,objects.filter(o=>['text','clip'].includes(o.type)).map(o=>o.id));assert.notEqual(pin.seriesId,'series-1');assert.equal(pin.fill,'#ff0000');
 assert.deepEqual(destination.settingsSnapshot().series.slice(0,defaults.length),defaults);
 assert.deepEqual(snapshot,original);assert.deepEqual(cb.export(token),original);
 assert.throws(()=>cb.pasteRemote(destination,snapshot,crypto.randomUUID(),{x:0,y:0}),/token mismatch/);
 destination.undo();assert.equal(destination.snapshot().length,0);assert.deepEqual(destination.settingsSnapshot().series,defaults);
 cb.clear();assert.equal(cb.export(token),null);
});
