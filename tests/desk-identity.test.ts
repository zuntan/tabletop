import assert from 'node:assert/strict';
import { test } from 'node:test';
import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate';
import { Desk, dispatch } from '../src/model';
import { createDeskId, deskNameSchema, downloadDeskFilename } from '../src/desk-identity';
import { encodeDeskFile, decodeDeskFile } from '../src/desk-file';

test('public desk IDs are short per-instance hints, stable across changes, load and Undo', () => {
  const desk = new Desk(), other = new Desk(), id = desk.deskId;
  assert.match(id, /^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
  assert.notEqual(other.deskId, id);
  assert.notEqual(id, desk.sessionId);
  for (let i = 0; i < 100; i++) assert.match(createDeskId(), /^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
  assert.equal(desk.summary().name, '');
  desk.execute({ operations: [{ kind: 'desk_rename', name: '  企画メモ  ' }] });
  assert.equal(desk.summary().name, '企画メモ');
  assert.equal(desk.settingsSnapshot().name, '企画メモ');
  assert.equal(desk.summary().deskId, id);
  desk.replaceDocument({ objects: [], settings: other.settingsSnapshot() });
  desk.undo(); desk.redo();
  assert.equal(desk.deskId, id);
  assert.equal(desk.sessionId, (dispatch(desk, { method: 'summary' }) as any).sessionId);
  for (const method of ['summary', 'list', 'state', 'context']) {
    const result = dispatch(desk, { method }) as any;
    assert.equal(result.deskId, id); assert.equal(result.name, '');
  }
  assert.equal((dispatch(desk, { method: 'file_snapshot' }) as any).deskId, undefined);
});

test('renaming is atomic, revision guarded, no-op aware and included in shared Undo/history', () => {
  const desk = new Desk();
  desk.execute({ operations: [{ kind: 'add', object: { id: 'memo', type: 'text' } }, { kind: 'desk_rename', name: '企画' }] });
  desk.select(['memo']); desk.point(['memo']);
  const original = desk.snapshot();
  desk.execute({ expectedRevision: 1, operations: [{ kind: 'desk_rename', name: '会議' }] });
  assert.deepEqual(desk.snapshot(), original); assert.deepEqual(desk.selected(), ['memo']); assert.deepEqual(desk.pointed(), ['memo']);
  assert.equal(desk.revision, 2);
  desk.execute({ operations: [{ kind: 'desk_rename', name: ' 会議 ' }] });
  assert.equal(desk.revision, 2);
  const history = desk.getChanges(1).changes[0];
  assert.deepEqual(history.targets, ['name']);
  assert.equal(history.settings?.before.name, '企画'); assert.equal(history.settings?.after.name, '会議');
  assert.deepEqual(history.details, []);
  desk.undo(); assert.equal(desk.summary().name, '企画');
  desk.redo(); assert.equal(desk.summary().name, '会議');
  const before = dispatch(desk, { method: 'state' });
  assert.throws(() => desk.execute({ expectedRevision: 0, operations: [{ kind: 'desk_rename', name: 'wrong' }] }), /Revision conflict/);
  assert.throws(() => desk.execute({ operations: [{ kind: 'desk_rename', name: 'wrong' }, { kind: 'delete', id: 'missing' }] }));
  assert.deepEqual(dispatch(desk, { method: 'state' }), before);
  for (const name of ['a'.repeat(101), 'two\nlines', 'bad\u0000name']) assert.equal(deskNameSchema.safeParse(name).success, false);
  desk.execute({ operations: [{ kind: 'desk_rename', name: '   ' }] }); assert.equal(desk.summary().name, '');
});

test('files persist the name but never IDs; same file in two desks has independent IDs; legacy names default empty', async () => {
  const source = new Desk(); source.execute({ operations: [{ kind: 'desk_rename', name: '同じ名前' }] });
  const bytes = await encodeDeskFile(source), files = unzipSync(bytes);
  const manifest = JSON.parse(strFromU8(files['manifest.json']));
  assert.equal(manifest.settings.name, '同じ名前'); assert.equal(manifest.version, 1);
  const json = JSON.stringify(manifest);
  assert.ok(!json.includes(source.deskId)); assert.ok(!json.includes(source.sessionId));
  const decoded = await decodeDeskFile(bytes);
  const first = new Desk(), second = new Desk();
  const firstId = first.deskId, secondId = second.deskId;
  first.replaceDocument({ objects: decoded.objects, settings: decoded.settings });
  second.replaceDocument({ objects: decoded.objects, settings: decoded.settings });
  assert.equal(first.summary().name, second.summary().name);
  assert.equal(first.deskId, firstId); assert.equal(second.deskId, secondId); assert.notEqual(firstId, secondId);
  first.undo(); assert.equal(first.summary().name, ''); first.redo(); assert.equal(first.summary().name, '同じ名前');
  delete manifest.settings.name;
  files['manifest.json'] = strToU8(JSON.stringify(manifest));
  const legacy = await decodeDeskFile(zipSync(files));
  first.replaceDocument({ objects: legacy.objects, settings: legacy.settings });
  assert.equal(first.summary().name, ''); assert.equal(first.deskId, firstId);
});

test('download suggestions use the name only, sanitize portable filenames without altering names and limit byte length', () => {
  for (const [name, expected] of [
    ['', '無題.tabletop'], ['  企画メモ  ', '企画メモ.tabletop'], ['  ', '無題.tabletop'], ['...', '無題.tabletop'],
    ['A/B:C\\D*?<>"|', 'A_B_C_D______.tabletop'], ['CON', '_CON.tabletop'], ['lpt9.notes', '_lpt9.notes.tabletop'],
    ['企画. ', '企画.tabletop'],
  ]) assert.equal(downloadDeskFilename(name), expected, name);
  const name = '名'.repeat(100), filename = downloadDeskFilename(name);
  assert.ok(new TextEncoder().encode(filename).length < 240);
  assert.ok(!filename.includes('�')); assert.equal(name.length, 100);
});
