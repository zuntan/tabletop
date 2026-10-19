import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';

test('wallpaper frames persist independently of local UI theme; dark controls keep desk content colors', { timeout: 30_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('ui-theme');
  page.setDefaultTimeout(5000);
  try {
    await call('desk_execute', { operations: [
      { kind: 'add', object: { id: 'note', type: 'text', x: 100, y: 100, text: 'Keep **my colors**', fill: '#fb7185', fillOpacity: 1 } },
      { kind: 'add', object: { id: 'locked', type: 'rect', x: 400, y: 100, locked: true } },
    ] });
    await call('desk_select', { ids: ['note', 'locked'] }); await call('desk_point', { ids: ['note'] });
    const palettes = [
      ['none', '#2563eb', '#15803d'], ['wood', '#1d4ed8', '#7c3aed'],
      ['cutting-mat', '#facc15', '#e879f9'], ['pink-notebook', '#1d4ed8', '#047857'], ['charcoal', '#60a5fa', '#a3e635'],
    ];
    for (const [wallpaper, human, ai] of palettes) {
      await call('desk_execute', { operations: [{ kind: 'background_update', patch: { wallpaper } }] });
      assert.equal(await page.locator('[data-human-selection="note"]').getAttribute('stroke'), human);
      assert.equal(await page.locator('[data-locked-selection="locked"]').getAttribute('stroke'), human);
      assert.equal(await page.locator('[data-ai-point="note"]').getAttribute('stroke'), ai);
    }
    assert.equal(await page.locator('#desk-background').getAttribute('fill'), '#252b33');
    assert.equal(await page.locator('#desk-wallpaper').getAttribute('fill'), 'none');
    const before = await call('desk_state'), camera = await call('desk_camera_get');
    const button = page.locator('#ui-theme');
    assert.equal(await button.locator('svg').getAttribute('data-icon'), 'moon');
    assert.equal((await button.boundingBox())!.width, 36);
    const order = await page.locator('header > button').evaluateAll(els => els.map(el => el.id));
    assert.ok(order.indexOf('thinking-mode') < order.indexOf('ui-theme') && order.indexOf('ui-theme') < order.indexOf('save-desk'));
    const cardColor = await page.locator('[data-id="note"] .markdown-text').evaluate(el => getComputedStyle(el).color);
    await button.click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    assert.equal(await button.locator('svg').getAttribute('data-icon'), 'sun');
    assert.equal(await page.locator('#sidebar').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(23, 30, 40)');
    assert.equal(await page.locator('[data-id="note"] .markdown-text').evaluate(el => getComputedStyle(el).color), cardColor);
    assert.equal(await page.locator('[data-id="note"] > rect').getAttribute('fill'), '#fb7185');
    await page.locator('#authoring-tools').getByRole('button', { name: '線幅の候補', exact: true }).click();
    assert.equal(await page.getByRole('dialog', { name: '線幅の候補', exact: true }).evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(32, 41, 54)');
    await page.keyboard.press('Escape');
    assert.deepEqual(await call('desk_state'), before); assert.deepEqual(await call('desk_camera_get'), camera);
    assert.deepEqual(await call('desk_ui_get'), { theme: 'dark' });
    assert.deepEqual((await call('desk_context')).ui, { theme: 'dark' });
    await call('desk_ui_set', { theme: 'light' });
    assert.equal(await button.locator('svg').getAttribute('data-icon'), 'moon');
    assert.equal(await page.evaluate(() => localStorage.getItem('tabletop-ui-theme')), 'light');
    assert.deepEqual(await call('desk_state'), before);
    assert.deepEqual(await call('desk_camera_get'), camera);
    await page.locator('#thinking-mode').click();
    assert.deepEqual(await call('desk_ui_get'), { theme: 'light' });
    await assert.rejects(call('desk_ui_set', { theme: 'dark' }), /ひとりで考え/);
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    await page.locator('#thinking-mode').click();
    await call('desk_ui_set', { theme: 'dark' });
    assert.equal(await button.locator('svg').getAttribute('data-icon'), 'sun');
    const saved = await call('desk_save', { filename: `theme-${Date.now()}.tabletop` });
    await call('desk_execute', { operations: [{ kind: 'background_update', patch: { wallpaper: 'none' } }] });
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    const current = await call('desk_summary');
    await call('desk_load', { filename: saved.filename, confirm: true, expectedRevision: current.revision, expectedSessionId: current.sessionId });
    assert.equal(await page.locator('#desk-background').getAttribute('data-wallpaper'), 'charcoal');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    for (const width of [1400, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    await page.reload();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.locator('#ui-theme').click(); await page.emulateMedia({ colorScheme: 'dark' });
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
