import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';

test('trimming saved/MCP properties leaves rendered shapes, text, lines, pins and media identical after reload', { timeout: 30_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('object-properties');
  try {
    const src = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>');
    await call('desk_execute', { operations: [
      { kind: 'add', object: { id: 'note', type: 'text', x: 100, y: 100, fillOpacity: 0, padding: 0, cornerRadius: 0, text: '**本文**', callout: { x: 400, y: 300, style: 'thought' } } },
      { kind: 'add', object: { id: 'shape', type: 'diamond', x: 400, y: 200, text: '判断', textFit: 'auto', fill: '#fcd34d', fillOpacity: 1 } },
      { kind: 'add', object: { id: 'line', type: 'line', x: 50, y: 50, x2: 100, y2: 300, strokeWidth: 8, dash: 'dotted', endMarker: 'arrow', endBinding: { objectId: 'shape', anchor: 'left' }, fontSize: 88, fill: '#ff0000' } },
      { kind: 'add', object: { id: 'asset', type: 'svg', x: 600, y: 300, src, fill: '#ff0000', fontSize: 88 } },
      { kind: 'label_add', id: 'pin', seriesId: 'series-1', x: 0, y: 0, description: '目印' },
      { kind: 'update', id: 'pin', patch: { attachment: { objectId: 'shape', anchor: 'top' } } },
    ] });
    await page.waitForFunction(() => document.fonts.status === 'loaded');
    const camera = await call('desk_camera_get');
    const visual = () => page.locator('#objects > [data-id]').evaluateAll(nodes => nodes.map(node => node.outerHTML));
    const before = await visual(), state = await call('desk_state');
    const line = await call('desk_get', { id: 'line' });
    assert.equal(line.fontSize, undefined); assert.equal(line.fill, undefined); assert.equal(line.width, undefined);
    const saved = await call('desk_save', { filename: 'meaningful-' + Date.now() + '.tabletop' });
    const current = await call('desk_summary');
    await call('desk_load', { filename: saved.filename, confirm: true, expectedSessionId: current.sessionId, expectedRevision: current.revision });
    await call('desk_camera_move', { center: camera.center, zoom: camera.zoom, durationMs: 0 });
    assert.deepEqual((await call('desk_state')).objects, state.objects);
    assert.deepEqual(await visual(), before);
    await call('desk_select', { ids: ['asset'] });
    assert.equal(await page.locator('#properties [name=fontSize]').isVisible(), false);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
