import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';

test('AI switches three built-in wallpapers without changing parts, snapping or camera; textures follow the desk and persist', { timeout: 30_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('desk-background');
  try {
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'note', type: 'text', text: '背景で色を変えない', fill: '#fb7185', fillOpacity: 1, x: 100, y: 100 } }] });
    await call('desk_select', { ids: ['note'] });
    const before = await call('desk_state'), camera = await call('desk_camera_get');
    assert.equal(await page.locator('#desk-grid').getAttribute('visibility'), 'visible');
    const colors = new Set<string>();
    for (const wallpaper of ['wood', 'cutting-mat', 'pink-notebook']) {
      await call('desk_execute', { operations: [{ kind: 'background_update', patch: { wallpaper } }] });
      assert.equal(await page.locator('#desk-background').getAttribute('data-wallpaper'), wallpaper);
      colors.add((await page.locator('#desk-background').getAttribute('fill'))!);
      assert.equal(await page.locator('#desk-wallpaper').getAttribute('fill'), 'url(#desk-surface-pattern)');
      assert.ok(await page.locator('#desk-surface-pattern > path').count() > 0);
      assert.equal(await page.locator('#desk-grid').getAttribute('visibility'), 'hidden');
      const state = await call('desk_state');
      assert.deepEqual(state.objects, before.objects); assert.deepEqual(state.selection, before.selection);
      assert.deepEqual(state.settings.grid, before.settings.grid); assert.deepEqual(await call('desk_camera_get'), camera);
    }
    assert.equal(colors.size, 3);
    await call('desk_camera_move', { center: { x: 400, y: 200 }, zoom: 2, durationMs: 0 });
    assert.equal(await page.locator('#desk-surface-pattern').getAttribute('patternTransform'), await page.locator('#viewport').getAttribute('transform'));
    await call('desk_execute', { operations: [{ kind: 'background_update', patch: { color: '#ffeedd', showGrid: true } }] });
    assert.equal(await page.locator('#desk-background').getAttribute('fill'), '#ffeedd');
    assert.equal(await page.locator('#desk-grid').getAttribute('visibility'), 'visible');
    const saved = await call('desk_save', { filename: `wallpaper-${Date.now()}.tabletop` });
    await call('desk_execute', { operations: [{ kind: 'background_update', patch: { wallpaper: 'none', color: null, showGrid: null } }] });
    assert.equal(await page.locator('#desk-wallpaper').getAttribute('fill'), 'none');
    const now = await call('desk_summary');
    await call('desk_load', { filename: saved.filename, confirm: true, expectedSessionId: now.sessionId, expectedRevision: now.revision });
    assert.equal(await page.locator('#desk-background').getAttribute('data-wallpaper'), 'pink-notebook');
    assert.equal(await page.locator('#desk-background').getAttribute('fill'), '#ffeedd');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
