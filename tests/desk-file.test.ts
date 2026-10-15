import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { Desk } from '../src/model';
import { encodeDeskFile, decodeDeskFile, MAX_DESK_FILE_BYTES } from '../src/desk-file';

const image = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>')}`;
function fixture() {
  const desk = new Desk();
  desk.execute({ operations: [
    { kind: 'defaults_update', patch: { fill: '#aabbcc', fontSize: 30 } },
    { kind: 'series_update', id: 'series-1', patch: { name: 'Notes', format: 'upper-alpha' } },
    { kind: 'add', object: { id: 'shape', type: 'rect', x: 42, text: '日本語', reactions: ['👍'] } },
    { kind: 'add', object: { id: 'text', type: 'text', text: '**Markdown**' } },
    { kind: 'add', object: { id: 'arrow', type: 'arrow', endBinding: { objectId: 'shape', anchor: 'left' } } },
    { kind: 'label_add', id: 'pin', seriesId: 'series-1', x: 9, y: 12, description: 'memo' },
    { kind: 'add', object: { id: 'svg1', type: 'svg', src: image, text: 'title', x: 70, width: 300, height: 200 } },
    { kind: 'add', object: { id: 'svg2', type: 'svg', src: image } },
    { kind: 'add', object: { id: 'remote', type: 'image', src: 'https://example.invalid/no-fetch.png' } },
    { kind: 'add', object: { id: 'link', type: 'link', url: 'https://example.com/' } },
  ] });
  return desk;
}
async function rewrite(change: (manifest: any, files: Record<string, Uint8Array>) => void) {
  const files = unzipSync(await encodeDeskFile(fixture()));
  const manifest = JSON.parse(strFromU8(files['manifest.json']));
  change(manifest, files);
  files['manifest.json'] = strToU8(JSON.stringify(manifest));
  return zipSync(files);
}
test('ZIP round-trip retains ordered objects, embedded assets, settings, bindings and pins', async () => {
  const desk = fixture();
  const bytes = await encodeDeskFile(desk);
  const files = unzipSync(bytes);
  assert.equal(Object.keys(files).filter(name => name.startsWith('assets/')).length, 1);
  assert.ok(!strFromU8(files['manifest.json']).includes(image));
  const result = await decodeDeskFile(bytes);
  assert.deepEqual(result.objects, desk.snapshot());
  assert.deepEqual(result.settings, desk.settingsSnapshot());
  assert.deepEqual(result.warnings, []);
});
test('missing images preserve geometry and title, display placeholder and can be re-saved', async () => {
  const bytes = await rewrite((_manifest, files) => {
    for (const name of Object.keys(files)) if (name.startsWith('assets/')) delete files[name];
  });
  const result = await decodeDeskFile(bytes);
  assert.deepEqual(result.warnings, ['svg1', 'svg2']);
  const object = result.objects.find(item => item.id === 'svg1')!;
  assert.equal(object.text, 'title'); assert.equal(object.x, 70); assert.equal(object.width, 300); assert.equal(object.height, 200);
  assert.match(atob(object.src!.split(',')[1]), /Missing image/);
  const desk = new Desk(); desk.replaceDocument({ objects: result.objects, settings: result.settings });
  assert.equal((await decodeDeskFile(await encodeDeskFile(desk))).objects.length, fixture().snapshot().length);
});
test('replacement is atomic, revision guarded by caller, and one shared Undo restores prior desk', async () => {
  const desk = fixture(), original = desk.snapshot(), settings = desk.settingsSnapshot();
  const other = new Desk(); other.execute({ operations: [{ kind: 'add', object: { id: 'new', type: 'ellipse' } }] });
  desk.select(['shape']); desk.point(['pin']);
  const loaded = await decodeDeskFile(await encodeDeskFile(other));
  desk.replaceDocument({ objects: loaded.objects, settings: loaded.settings });
  assert.deepEqual(desk.snapshot(), other.snapshot()); assert.deepEqual(desk.selected(), []); assert.deepEqual(desk.pointed(), []);
  desk.undo(); assert.deepEqual(desk.snapshot(), original); assert.deepEqual(desk.settingsSnapshot(), settings);
  desk.redo(); assert.deepEqual(desk.snapshot(), other.snapshot());
  const revision = desk.revision;
  assert.throws(() => desk.replaceDocument({ objects: [{ id: 'bad', type: 'image' }], settings }));
  assert.equal(desk.revision, revision); assert.deepEqual(desk.snapshot(), other.snapshot());
});
test('invalid manifests, references, versions, objects and assets are rejected', async () => {
  const invalid = [
    (m: any) => { m.version = 99; },
    (m: any) => { m.objects[0].x = 'wrong'; },
    (m: any) => { m.objects.push(m.objects[0]); },
    (m: any) => { m.settings.series.push(m.settings.series[0]); },
    (m: any) => { m.objects.find((o: any) => o.id === 'arrow').endBinding.objectId = 'absent'; },
    (m: any) => { m.objects.find((o: any) => o.id === 'pin').seriesId = 'absent'; },
    (m: any) => { m.assets.svg1.path = '../bad'; },
    (m: any) => { m.assets.absent = m.assets.svg1; },
    (m: any) => { m.assets.svg1.mime = 'image/png'; },
    (m: any, files: Record<string, Uint8Array>) => { files[m.assets.svg1.path][0] ^= 1; },
  ];
  for (const change of invalid) await assert.rejects(decodeDeskFile(await rewrite(change)));
  await assert.rejects(decodeDeskFile(zipSync({ 'manifest.json': strToU8('{') })));
  await assert.rejects(decodeDeskFile(zipSync({})));
  await assert.rejects(decodeDeskFile(new Uint8Array([1, 2, 3])));
});
test('archive limits and unexpected paths are rejected before extraction', async () => {
  await assert.rejects(decodeDeskFile(new Uint8Array(MAX_DESK_FILE_BYTES + 1)));
  await assert.rejects(decodeDeskFile(zipSync({ '../outside': strToU8('x') })));
  const name = `assets/${'a'.repeat(64)}.png`;
  await assert.rejects(decodeDeskFile(zipSync({ [name]: new Uint8Array(5 * 1024 * 1024 + 1) })));
});
test('ZIP CRC corruption and encrypted flags are rejected', async () => {
  const bytes = await encodeDeskFile(fixture());
  const corrupt = bytes.slice();
  const text = new TextDecoder().decode(corrupt);
  const index = text.indexOf('日本語');
  // Use the ASCII manifest marker to change valid JSON without changing ZIP metadata.
  const marker = new TextEncoder().encode('tabletop');
  const offset = bytes.findIndex((_, start) => marker.every((byte, i) => bytes[start + i] === byte));
  assert.ok(index >= 0 && offset >= 0);
  corrupt[offset] = 'T'.charCodeAt(0);
  await assert.rejects(decodeDeskFile(corrupt), /checksum/);
  const encrypted = bytes.slice();
  const view = new DataView(encrypted.buffer);
  const end = bytes.length - 22, directory = view.getUint32(end + 16, true);
  view.setUint16(directory + 8, 1, true);
  await assert.rejects(decodeDeskFile(encrypted), /Unsupported/);
});
test('empty desks round-trip', async () => {
  const desk = new Desk();
  const result = await decodeDeskFile(await encodeDeskFile(desk));
  assert.deepEqual(result.objects, []); assert.deepEqual(result.settings, desk.settingsSnapshot());
});
