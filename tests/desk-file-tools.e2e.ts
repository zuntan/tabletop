import { respondToConfirm } from './confirm-response';
import { publishObject } from '../src/object-properties';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zipSync, strToU8, unzipSync } from 'fflate';
import { openTestDesk } from './desk-browser';
import { decodeDeskFile } from '../src/desk-file';

test('real MCP save/load round-trip, browser interoperability, conflicts and safe failures', { timeout: 45_000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'tabletop-save-mcp-'));
  const oldRoot = process.env.TABLETOP_SAVE_ROOT; process.env.TABLETOP_SAVE_ROOT = root;
  const desk = await openTestDesk('desk-file-tools-e2e');
  if (oldRoot === undefined) delete process.env.TABLETOP_SAVE_ROOT; else process.env.TABLETOP_SAVE_ROOT = oldRoot;
  try {
    const { page, call, client } = desk;
    const src = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>')}`;
    const tools = (await client.listTools()).tools;
    assert.ok(tools.some(tool => tool.name === 'desk_save'));
    assert.equal(tools.find(tool => tool.name === 'desk_load')?.annotations?.destructiveHint, true);
    await call('desk_execute', { operations: [
      { kind: 'defaults_update', patch: { fill: '#abcdef' } },
      { kind: 'add', object: { id: 'note', type: 'rect', x: 9000, text: 'Saved' } },
      { kind: 'add', object: { id: 'svg', type: 'svg', src } },
      { kind: 'label_add', id: 'pin', seriesId: 'series-1', x: 9, y: 9 },
      { kind: 'add', object: { id: 'line', type: 'arrow', endBinding: { objectId: 'note', anchor: 'left' } } },
    ] });
    const original = await call('desk_state');
    const saved = await call('desk_save', { filename: 'desk.tabletop' });
    assert.equal(saved.path, join(root, 'desk.tabletop')); assert.equal(saved.revision, original.revision); assert.equal(saved.formatVersion, 1);
    const bytes = await readFile(saved.path);
    const decoded = await decodeDeskFile(bytes);
    assert.deepEqual(decoded.objects.map(publishObject), original.objects); assert.deepEqual(decoded.settings, original.settings);
    assert.deepEqual(await call('desk_state'), original);
    async function fails(name: string, args: Record<string, unknown>) {
      const before = await call('desk_state');
      const result = await client.callTool({ name, arguments: args });
      assert.equal(result.isError, true, JSON.stringify(result));
      assert.deepEqual(await call('desk_state'), before);
    }
    await fails('desk_save', { filename: 'desk.tabletop' });
    assert.deepEqual(await readFile(saved.path), bytes);
    await fails('desk_save', { filename: '../escape.tabletop' });
    const guards = { expectedSessionId: original.sessionId, expectedRevision: original.revision };
    await fails('desk_load', { filename: 'desk.tabletop', ...guards });
    await fails('desk_load', { filename: 'desk.tabletop', confirm: false, ...guards });
    await fails('desk_load', { filename: 'desk.tabletop', confirm: true, ...guards, expectedSessionId: crypto.randomUUID() });
    await call('desk_execute', { operations: [{ kind: 'update', id: 'note', patch: { text: 'Changed' } }] });
    await fails('desk_load', { filename: 'desk.tabletop', confirm: true, ...guards });
    const summary = await call('desk_summary');
    const current = { expectedSessionId: summary.sessionId, expectedRevision: summary.revision, confirm: true };
    await writeFile(join(root, 'broken.tabletop'), zipSync({ 'manifest.json': strToU8('{broken') }));
    await fails('desk_load', { filename: 'broken.tabletop', ...current });
    await fails('desk_load', { filename: 'missing.tabletop', ...current });
    // Reusing IDs must not retain either participant's selection frame after replacement.
    await call('desk_select', { ids: ['note'] }); await call('desk_point', { ids: ['note'] });
    assert.ok(await page.locator('[data-ai-point="note"]').count());
    const loaded = await call('desk_load', { filename: 'desk.tabletop', ...current });
    assert.deepEqual((await call('desk_state')).selection, []);
    assert.deepEqual((await call('desk_state')).aiPointing, []);
    assert.equal(await page.locator('[data-ai-point], [data-human-selection], [data-resize], [data-endpoint]').count(), 0);
    assert.equal(await page.locator('#object-list .active').count(), 0);
    assert.equal(loaded.count, 4); assert.deepEqual(loaded.missingAssets, []);
    assert.equal((await call('desk_changes', { sinceRevision: summary.revision })).changes.at(-1).actor, 'agent-01');
    assert.deepEqual((await call('desk_state')).objects, original.objects);
    await page.locator('[data-id="note"]').dblclick();
    assert.equal(await page.locator('.inline-editor').count(), 1);
    await fails('desk_load', { filename: 'desk.tabletop', confirm: true, expectedSessionId: loaded.sessionId, expectedRevision: loaded.revision });
    await page.keyboard.press('Escape');
    await call('desk_undo'); assert.equal((await call('desk_get', { id: 'note' })).text, 'Changed');
    await call('desk_redo'); assert.equal((await call('desk_get', { id: 'note' })).text, 'Saved');
    // The browser UI must load files written by MCP.
    await call('desk_select', { ids: ['note'] }); await call('desk_point', { ids: ['note'] });
    const confirmation1 = respondToConfirm(page, 'proceed');
    await page.locator('#desk-file').setInputFiles(saved.path);
    await confirmation1;
    await page.waitForFunction(() => document.querySelector('#message')?.textContent === '読込完了');
    assert.deepEqual((await call('desk_state')).objects, original.objects);
    assert.deepEqual((await call('desk_state')).selection, []);
    assert.deepEqual((await call('desk_state')).aiPointing, []);
    assert.equal(await page.locator('[data-ai-point], [data-human-selection], [data-resize], [data-endpoint]').count(), 0);
    assert.equal(await page.locator('#object-list .active').count(), 0);
    // And MCP must load a browser-downloaded file.
    const downloading = page.waitForEvent('download'); await page.locator('#file-menu').click(); await page.locator('#save-desk').click();
    const download = await downloading;
    const browserBytes = await readFile((await download.path())!);
    await writeFile(join(root, 'browser.tabletop'), browserBytes);
    const latest = await call('desk_summary');
    await call('desk_load', { filename: 'browser.tabletop', confirm: true, expectedSessionId: latest.sessionId, expectedRevision: latest.revision });
    // Missing assets remain a partial-success warning, not a failed load.
    const files = unzipSync(browserBytes);
    for (const name of Object.keys(files)) if (name.startsWith('assets/')) delete files[name];
    await writeFile(join(root, 'missing-asset.tabletop'), zipSync(files));
    const last = await call('desk_summary');
    const missing = await call('desk_load', { filename: 'missing-asset.tabletop', confirm: true, expectedSessionId: last.sessionId, expectedRevision: last.revision });
    assert.deepEqual(missing.missingAssets, ['svg']);
    assert.deepEqual(desk.errors, []);
  } finally { await desk.close(); await rm(root, { recursive: true, force: true }); }
});
