import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Desk, dispatch } from '../src/model';
import { DeskFileStore, validateDeskFilename } from '../src/desk-file-store';
import { checkDeskBridgeSize } from '../src/desk-file-protocol';

test('desk file store confines filenames, creates exclusively and rejects symlinks/non-files/oversize', async () => {
  const root = await mkdtemp(join(tmpdir(), 'tabletop-save-store-'));
  const store = new DeskFileStore(join(root, 'saves'));
  try {
    for (const name of ['../escape.tabletop', '/tmp/no.tabletop', 'a\\b.tabletop', 'file.zip', '.hidden.tabletop', 'CON.tabletop', 'a/b.tabletop']) {
      assert.throws(() => validateDeskFilename(name));
      await assert.rejects(store.save(name, new Uint8Array([1])));
      await assert.rejects(store.load(name));
    }
    const bytes = Buffer.from([1, 2, 3]);
    const path = await store.save('desk-01.tabletop', bytes);
    assert.deepEqual(await store.load('desk-01.tabletop'), bytes);
    await assert.rejects(store.save('desk-01.tabletop', new Uint8Array([9])), /EEXIST/);
    assert.deepEqual(await store.load('desk-01.tabletop'), bytes);
    if (process.platform !== 'win32') {
      assert.equal((await stat(path)).mode & 0o777, 0o600);
      await symlink(path, join(root, 'saves', 'link.tabletop'));
      await assert.rejects(store.load('link.tabletop'), /symlink/);
      await assert.rejects(store.save('link.tabletop', bytes), /EEXIST/);
    }
    await writeFile(join(root, 'saves', 'empty.tabletop'), '');
    await assert.rejects(store.load('empty.tabletop'));
    await assert.rejects(store.load('absent.tabletop'), /ENOENT/);
    await assert.rejects(store.save('huge.tabletop', new Uint8Array(50 * 1024 * 1024 + 1)));
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('file bridge requires explicit confirmation and current session/revision, commits atomically with Undo', () => {
  const desk = new Desk();
  desk.execute({ operations: [{ kind: 'add', object: { id: 'old', type: 'rect' } }] });
  const snapshot = dispatch(desk, { method: 'file_snapshot' }) as { sessionId: string; revision: number; objects: unknown[]; settings: unknown };
  const original = desk.snapshot();
  const request = { method: 'load_document', confirm: true, expectedSessionId: desk.sessionId, expectedRevision: desk.revision,
    document: { objects: [], settings: desk.settingsSnapshot() } };
  for (const bad of [{ ...request, confirm: false }, { ...request, confirm: undefined },
    { ...request, expectedRevision: 0 }, { ...request, expectedSessionId: crypto.randomUUID() },
    { ...request, document: { objects: [{ id: 'bad', type: 'image' }], settings: desk.settingsSnapshot() } }]) {
    assert.throws(() => dispatch(desk, bad)); assert.deepEqual(desk.snapshot(), original); assert.equal(desk.revision, snapshot.revision);
  }
  dispatch(desk, request); assert.equal(desk.snapshot().length, 0);
  desk.undo(); assert.deepEqual(desk.snapshot(), original);
  assert.equal(snapshot.objects.length, 1);
  assert.throws(() => checkDeskBridgeSize({ text: 'あ'.repeat(7_000_000) }), /20 MB/);
});
