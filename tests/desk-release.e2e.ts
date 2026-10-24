import {callTestTool} from './mcp-call';
import { respondToConfirm } from './confirm-response';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { openTestDesk } from './desk-browser';
import { decodeDeskFile } from '../src/desk-file';
import { publishObject } from '../src/object-properties';

test('release preserves the local desk, stops retries, accepts another desk and allows deliberate manual return', { timeout: 40_000 }, async () => {
  const { page, call, client, close, port, errors } = await openTestDesk('release-e2e');
  try {
    await call('desk_execute', { operations: [
      { kind: 'add', object: { id: 'kept', type: 'rect', text: 'Keep this desk', x: 120, y: 120 } },
      { kind: 'grid_update', patch: { interval: 32 } },
    ] });
    await call('desk_point', { ids: ['kept'] });
    const original = await call('desk_state');
    const denied = await callTestTool(client, { name: 'desk_release', arguments: { confirm: false } });
    assert.equal(denied.isError, true);
    assert.equal((await call('desk_summary')).count, 1);
    let reconnects = 0; page.on('websocket', () => reconnects++);
    const released=await call('desk_release',{confirm:true});assert.equal(released.released,true);assert.equal(released.deskId,original.deskId);assert.equal(released.bootstrapReady,true);
    await page.waitForFunction(() => document.querySelector('#connection')?.textContent === 'AI接続解放済み');
    assert.equal((await client.callTool({name:'desk_pairing_info',arguments:{deskId:original.deskId}})).isError,true);
    assert.equal((await call('desk_connection_info')).browserConnected, false);
    assert.equal((await callTestTool(client, { name: 'desk_summary' })).isError, true);
    // Local editing and shared history still work with no AI connection.
    await page.locator('#undo').click();
    assert.equal(await page.locator('[data-id="kept"]').count(), 0);
    await page.locator('#redo').click();
    assert.ok(await page.locator('[data-id="kept"]').count());
    // Local download still works without an AI connection and retains objects/settings.
    const downloading = page.waitForEvent('download'); await page.locator('#file-menu').click(); await page.locator('#download-desk').click();
    const saved = await decodeDeskFile(new Uint8Array(await readFile((await (await downloading).path())!)));
    assert.deepEqual(saved.objects.map(publishObject), original.objects.map(publishObject));
    assert.deepEqual(saved.settings, original.settings);
    const second = await page.context().browser()!.newPage();
    const token = 'release-e2e-012345678901234567890123456789';
    await second.goto(`http://127.0.0.1:${port}/#token=${token}&port=${port}`);
    await second.waitForFunction(() => document.querySelector('#connection')?.textContent === 'MCP接続済み');
    assert.equal((await call('desk_summary',{deskId:await second.locator('#desk-id').textContent()})).count, 0);
    await page.waitForTimeout(5500);
    assert.equal(reconnects, 0);
    assert.equal((await call('desk_summary',{deskId:await second.locator('#desk-id').textContent()})).count, 0);
    await call('desk_release', {deskId:await second.locator('#desk-id').textContent(),confirm: true });
    // Explicit manual connection keeps the first tab's content and session/history.
    const confirmation1 = respondToConfirm(page, 'proceed');
    await page.locator('#connect-form').evaluate(element => (element as HTMLFormElement).requestSubmit());
    await confirmation1;
    await page.waitForFunction(() => document.querySelector('#connection')?.textContent === 'MCP接続済み');
    const returned = await call('desk_state');
    assert.deepEqual(returned.objects, original.objects);
    assert.deepEqual(returned.settings, original.settings);
    assert.equal(returned.sessionId, original.sessionId);
    assert.equal(returned.revision, original.revision + 2);
    assert.deepEqual((await call('desk_selection')).aiPointing, []);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
