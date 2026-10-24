import {callTestTool} from './mcp-call';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { openTestDesk } from './desk-browser';

test('AI reads semantic state and image/SVG content, attaches pins and replaces assets with shared Undo', { timeout: 45_000 }, async () => {
  const { page, client, call, close, errors } = await openTestDesk('ai-interface-test');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><rect width="240" height="120" fill="orange"/></svg>';
  try {
    let context = await call('desk_context'); assert.equal(context.count, 0);
    await call('desk_execute', { expectedRevision: context.revision, operations: [
      { kind: 'add', object: { id: 'start', type: 'rect', x: 200, y: 100, text: 'Start' } },
      { kind: 'label_add', id: 'pin-1', seriesId: 'series-1', x: 500, y: 120, description: 'First' },
      { kind: 'label_add', id: 'pin-2', seriesId: 'series-1', x: 620, y: 120, description: 'Next' },
      { kind: 'add', object: { id: 'relation', type: 'arrow', startBinding: { objectId: 'start', anchor: 'right' }, endBinding: { objectId: 'pin-1', anchor: 'left' } } },
    ] });
    context = await call('desk_context');
    assert.equal(context.settings.series[0].members[1].number, 2); assert.equal(context.settings.series[0].next, 3);
    assert.equal(context.connections[0].end.binding.objectId, 'pin-1');
    await call('desk_asset_import', { id: 'svg', source: { svg }, x: 250, y: 280, width: 240, height: 154, title: 'Original', url: 'https://example.com/' });
    const read = await call('desk_asset_read', { id: 'svg', exportFile: true });
    assert.equal(read.svg, svg); assert.equal(await readFile(read.path, 'utf8'), svg);
    await call('desk_asset_import', { id: 'from-file', source: { path: read.path }, x: 600, y: 280 });
    assert.equal((await call('desk_asset_read', { id: 'from-file' })).svg, svg);
    const before = await call('desk_get', { id: 'svg' });
    const replacement = svg.replace('orange', 'blue');
    context = await call('desk_context');
    await call('desk_asset_import', { id: 'svg', mode: 'replace', source: { svg: replacement }, expectedRevision: context.revision });
    const after = await call('desk_get', { id: 'svg' });
    assert.deepEqual({ ...after, src: before.src }, before);
    assert.equal((await call('desk_asset_read', { id: 'svg' })).svg, replacement);
    await page.locator('#undo').click(); assert.equal((await call('desk_asset_read', { id: 'svg' })).svg, svg);
    await page.locator('#redo').click(); assert.equal((await call('desk_asset_read', { id: 'svg' })).svg, replacement);
    const conflict = await callTestTool(client, { name: 'desk_asset_import', arguments: { id: 'svg', mode: 'replace', source: { svg }, expectedRevision: 0 } });
    assert.equal(conflict.isError, true);
    const denied = await callTestTool(client, { name: 'desk_asset_import', arguments: { id: 'bad', source: { path: '/etc/passwd' } } });
    assert.equal(denied.isError, true);
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    await call('desk_asset_import', { id: 'png', source: { dataUrl: `data:image/png;base64,${png}` } });
    const raster = await callTestTool(client, { name: 'desk_asset_read', arguments: { id: 'png' } });
    assert.notEqual(raster.isError, true);
    const image = (raster as import('@modelcontextprotocol/sdk/types.js').CallToolResult).content.find(block => block.type === 'image');
    assert.equal(image?.type, 'image');
    if (image?.type === 'image') { assert.equal(image.mimeType, 'image/png'); assert.equal(image.data, png); }
    const previous = (await call('desk_context')).revision;
    await call('desk_execute', { expectedRevision: previous, operations: [
      { kind: 'update', id: 'relation', patch: { endBinding: { objectId: 'pin-2', anchor: 'left' } } },
      { kind: 'update', id: 'start', patch: { x: 224 } },
    ] });
    const changes = await call('desk_context', { sinceRevision: previous });
    assert.equal(changes.connections[0].start.x, 404);
    assert.equal(changes.connections[0].end.binding.objectId, 'pin-2');
    assert.equal(changes.history.changes.length, 1);
    assert.equal(changes.history.changes[0].details.length, 2);
    await call('desk_execute', { operations: [{ kind: 'update', id: 'relation', patch: { endBinding: null } }] });
    assert.equal((await call('desk_context')).connections[0].end.binding, null);
    await page.locator('#tab-history').click(); assert.ok(await page.locator('#history .history-row').count() > 0);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
