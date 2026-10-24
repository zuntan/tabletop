import {callTestTool} from './mcp-call';
import { respondToConfirm } from './confirm-response';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { openTestDesk } from './desk-browser';
import { decodeDeskFile } from '../src/desk-file';

test('name editing, download names, AI save/load, same-named tabs and manual reconnection keep identity rules', { timeout: 45_000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'tabletop-identity-'));
  const oldRoot = process.env.TABLETOP_SAVE_ROOT; process.env.TABLETOP_SAVE_ROOT = root;
  let desk: Awaited<ReturnType<typeof openTestDesk>>;
  try { desk = await openTestDesk('desk-identity-e2e'); }
  finally { if (oldRoot === undefined) delete process.env.TABLETOP_SAVE_ROOT; else process.env.TABLETOP_SAVE_ROOT = oldRoot; }
  try {
    const { page, call, client, port } = desk;
    const first = await call('desk_summary');
    const id = first.deskId;
    assert.equal(first.name, ''); assert.equal(await page.locator('#desk-name').textContent(), '無題');
    assert.equal(await page.locator('#desk-id').textContent(), id);
    const emptyDownload = page.waitForEvent('download'); await page.locator('#file-menu').click(); await page.locator('#download-desk').click();
    assert.equal((await emptyDownload).suggestedFilename(), '無題.tabletop');
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'kept', type: 'rect', text: 'Keep me' } }] });
    const displayedName = await page.locator('#desk-name').boundingBox();
    const displayedEdit = await page.locator('#edit-desk-name').boundingBox();
    assert.ok(displayedName && displayedEdit && displayedName.width < 100);
    assert.ok(displayedEdit.x - (displayedName.x + displayedName.width) <= 10);
    const displayedId = await page.locator('#desk-id').boundingBox();
    assert.equal(await page.locator('#desk-name').evaluate(element => getComputedStyle(element).fontSize), '23px');
    await page.locator('#edit-desk-name').click();
    const inputBox = await page.locator('#desk-name-input').boundingBox();
    assert.ok(displayedName && inputBox);
    for (const key of ['x', 'y', 'width', 'height'] as const) assert.ok(Math.abs(displayedName[key] - inputBox[key]) <= 2, key);
    assert.deepEqual(await page.locator('#desk-id').boundingBox(), displayedId);
    assert.equal(await page.locator('#desk-name-input').evaluate(element => getComputedStyle(element).fontSize), '23px');
    await page.locator('#desk-name-input').fill('  企画/メモ:案  ');
    // Read-only AI requests leave the name draft and focus untouched; mutations are refused.
    await call('desk_context');
    assert.equal(await page.locator('#desk-name-input').inputValue(), '  企画/メモ:案  ');
    assert.equal(await page.locator('#desk-name-input').evaluate(element => element === document.activeElement), true);
    assert.equal((await callTestTool(client, { name: 'desk_execute', arguments: { operations: [{ kind: 'desk_rename', name: 'AI overwrite' }] } })).isError, true);
    await page.locator('#desk-name-input').press('Enter');
    assert.equal((await call('desk_summary')).name, '企画/メモ:案');
    assert.equal(await page.locator('#desk-name').textContent(), '企画/メモ:案');
    assert.ok((await page.title()).includes(id));
    await page.locator('#undo').click(); assert.equal(await page.locator('#desk-name').textContent(), '無題');
    await page.locator('#redo').click(); assert.equal(await page.locator('#desk-name').textContent(), '企画/メモ:案');
    await page.locator('#edit-desk-name').click();
    await page.locator('#desk-name-input').fill('取消する');
    await page.locator('#desk-name-input').press('Escape');
    assert.equal((await call('desk_summary')).name, '企画/メモ:案');
    const downloading = page.waitForEvent('download'); await page.locator('#file-menu').click(); await page.locator('#download-desk').click();
    const download = await downloading;
    assert.equal(download.suggestedFilename(), '企画_メモ_案.tabletop');
    const bytes = await readFile((await download.path())!);
    const decoded = await decodeDeskFile(bytes); assert.equal(decoded.settings.name, '企画/メモ:案');
    assert.ok(!JSON.stringify(decoded).includes(id));
    const saved = await call('desk_save', { filename: 'ai-chosen.tabletop' });
    assert.equal(saved.path, join(root, 'ai-chosen.tabletop'));
    assert.equal((await decodeDeskFile(await readFile(saved.path))).settings.name, '企画/メモ:案');
    await call('desk_execute', { operations: [{ kind: 'desk_rename', name: '<img src=x onerror=alert(1)>' }] });
    assert.equal(await page.locator('#desk-name img').count(), 0);
    assert.equal(await page.locator('#desk-name').textContent(), '<img src=x onerror=alert(1)>');
    const current = await call('desk_summary');
    await call('desk_load', { filename: 'ai-chosen.tabletop', confirm: true, expectedSessionId: current.sessionId, expectedRevision: current.revision });
    assert.equal(await page.locator('#desk-name').textContent(), '企画/メモ:案');
    assert.equal((await call('desk_summary')).deskId, id);
    // A disconnected second tab can load the identical file without inheriting the first tab's ID.
    const second = await page.context().browser()!.newPage();
    await second.goto(`http://127.0.0.1:${port}/`);
    const secondId = await second.locator('#desk-id').textContent(); assert.notEqual(secondId, id);
    const confirmation1 = respondToConfirm(second, 'proceed');
    await second.locator('#desk-file').setInputFiles({ name: 'same.tabletop', mimeType: 'application/zip', buffer: bytes });
    await confirmation1;
    await second.waitForFunction(() => document.querySelector('#message')?.textContent === '読込完了');
    assert.equal(await second.locator('#desk-name').textContent(), '企画/メモ:案');
    assert.equal(await second.locator('#desk-id').textContent(), secondId);
    // Legacy files have no name; loading clears the previous name, Undo restores it, ID never changes.
    const files = unzipSync(bytes), manifest = JSON.parse(strFromU8(files['manifest.json']));
    delete manifest.settings.name; files['manifest.json'] = strToU8(JSON.stringify(manifest));
    const confirmation2 = respondToConfirm(page, 'proceed');
    await page.locator('#desk-file').setInputFiles({ name: 'legacy.tabletop', mimeType: 'application/zip', buffer: Buffer.from(zipSync(files)) });
    await confirmation2;
    await page.waitForFunction(() => document.querySelector('#message')?.textContent === '読込完了');
    assert.equal(await page.locator('#desk-name').textContent(), '無題');
    await page.locator('#undo').click(); assert.equal(await page.locator('#desk-name').textContent(), '企画/メモ:案');
    assert.equal(await page.locator('#desk-id').textContent(), id);
    // Short hint and name survive intentional disconnect and a new pairing.
    await call('desk_release', { confirm: true });
    assert.equal(await page.locator('#desk-id').textContent(), id);
    const confirmation3 = respondToConfirm(page, 'proceed');
    await page.locator('#connect-form').evaluate(element => (element as HTMLFormElement).requestSubmit());
    await confirmation3;
    await page.waitForFunction(() => document.querySelector('#connection')?.textContent === 'MCP接続済み');
    const returned = await call('desk_summary'); assert.notEqual(returned.deskId, id); assert.equal(returned.deskId,await page.locator('#desk-id').textContent()); assert.equal(returned.name, '企画/メモ:案');
    // Narrow headers remain usable, including long names and the inline form.
    await call('desk_execute', { operations: [{ kind: 'desk_rename', name: '長い名前'.repeat(25) }] });
    await page.setViewportSize({ width: 390, height: 900 });
    const wrapped = await page.locator('#desk-name').evaluate(element => ({ height: element.getBoundingClientRect().height, overflow: getComputedStyle(element).overflow, ellipsis: getComputedStyle(element).textOverflow, fullText: element.scrollHeight <= element.clientHeight }));
    assert.ok(wrapped.height > 40); assert.equal(wrapped.fullText, true);
    assert.notEqual(wrapped.ellipsis, 'ellipsis'); assert.notEqual(wrapped.overflow, 'hidden');
    const narrowId = await page.locator('#desk-id').boundingBox();
    await page.locator('#edit-desk-name').click();
    assert.ok(await page.locator('#desk-name-input').isVisible());
    assert.deepEqual(await page.locator('#desk-id').boundingBox(), narrowId);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('#desk-name-input').press('Escape');
    await call('desk_execute', { operations: [{ kind: 'desk_rename', name: '短' }] });
    const shortName = await page.locator('#desk-name').boundingBox();
    assert.ok(shortName && shortName.width < 80);
    await page.locator('#edit-desk-name').click();
    assert.ok((await page.locator('#desk-name-input').boundingBox())!.width >= 48);
    await page.locator('#desk-name-input').press('Escape');
    assert.deepEqual(desk.errors, []);
  } finally { await desk.close(); await rm(root, { recursive: true, force: true }); }
});
