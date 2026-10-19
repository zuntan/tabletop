import { publishObject } from '../src/object-properties';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { zipSync, strToU8 } from 'fflate';
import { openTestDesk } from './desk-browser';
import { decodeDeskFile } from '../src/desk-file';

test('save/download, load/upload, shared Undo, rejected file, and cancel work in an isolated desk', async () => {
  const desk = await openTestDesk('desk-file-e2e');
  try {
    const { page, call } = desk;
    const src = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40"><rect width="30" height="40" fill="red"/></svg>')}`;
    await call('desk_execute', { operations: [
      { kind: 'add', object: { id: 'note', type: 'rect', x: 120, y: 80, text: 'Saved note' } },
      { kind: 'add', object: { id: 'picture', type: 'svg', x: 400, y: 80, src } },
      { kind: 'label_add', id: 'pin', seriesId: 'series-1', x: 200, y: 300 },
    ] });
    const original = await call('desk_state');
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#save-desk').click();
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /\.tabletop$/);
    const bytes = await readFile((await download.path())!);
    const parsed = await decodeDeskFile(bytes);
    assert.deepEqual(parsed.objects.map(publishObject), original.objects);
    await call('desk_execute', { operations: [{ kind: 'update', id: 'note', patch: { text: 'Changed' } }] });
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#desk-file').setInputFiles({ name: 'roundtrip.tabletop', mimeType: 'application/zip', buffer: bytes });
    await page.waitForFunction(() => document.querySelector('#message')?.textContent === '読込完了');
    assert.deepEqual((await call('desk_state')).objects, original.objects);
    const loadedImage = page.locator('[data-id="picture"] image');
    assert.ok(await loadedImage.count());
    assert.equal(await loadedImage.getAttribute('href'), src);
    await page.locator('#undo').click();
    assert.equal((await call('desk_get', { id: 'note' })).text, 'Changed');
    await page.locator('#redo').click();
    assert.equal((await call('desk_get', { id: 'note' })).text, 'Saved note');
    const before = await call('desk_state');
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#desk-file').setInputFiles({ name: 'broken.tabletop', mimeType: 'application/zip',
      buffer: Buffer.from(zipSync({ 'manifest.json': strToU8('{broken') })) });
    await page.waitForFunction(() => document.querySelector('#message')?.textContent?.startsWith('読込失敗'));
    assert.deepEqual(await call('desk_state'), before);
    page.once('dialog', dialog => dialog.dismiss());
    await page.locator('#desk-file').setInputFiles({ name: 'cancel.tabletop', mimeType: 'application/zip', buffer: bytes });
    assert.deepEqual(await call('desk_state'), before);
    assert.deepEqual(desk.errors, []);
  } finally { await desk.close(); }
});
