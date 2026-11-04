import test from 'node:test';
import assert from 'node:assert/strict';
import { openTestDesk } from './desk-browser';

test('local UI language switches without changing the document, camera, selection, or history', { timeout: 45_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('ui-language', undefined, undefined, 'en-US');
  page.setDefaultTimeout(5000);
  const openLanguage = async () => {
    await page.locator('#desk-menu').click();
    await page.locator('#desk-menu-panel > .desk-menu-item').nth(1).click();
  };
  try {
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    assert.equal(await page.locator('#undo').getAttribute('aria-label'), 'Undo');
    assert.equal(await page.locator('#desk-menu').getAttribute('aria-label'), 'Menu');
    assert.equal(await page.locator('#desk-menu svg').count(), 1);
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'note', type: 'text', text: '日本語の本文とEnglish', x: 50, y: 60 } }] });
    await call('desk_select', { ids: ['note'] });
    await call('desk_point', { ids: ['note'] });
    const before = await call('desk_state'), camera = await call('desk_camera_get');
    const selection = await call('desk_selection'), changes = await call('desk_changes', { sinceRevision: 0 });
    await openLanguage();
    await page.locator('#ui-language').selectOption('ja');
    await page.waitForFunction(() => document.documentElement.lang === 'ja');
    assert.equal(await page.locator('#undo').getAttribute('aria-label'), '元に戻す');
    assert.equal(await page.locator('#desk-menu').getAttribute('aria-label'), 'メニュー');
    assert.equal(await page.locator('#desk-menu svg').count(), 1);
    assert.equal(await page.locator('#ui-language').inputValue(), 'ja');
    assert.deepEqual(await call('desk_state'), before);
    assert.deepEqual(await call('desk_camera_get'), camera);
    assert.deepEqual(await call('desk_selection'), selection);
    assert.deepEqual(await call('desk_changes', { sinceRevision: 0 }), changes);
    assert.equal(await page.evaluate(() => localStorage.getItem('tabletop.ui.language')), 'ja');

    // Keep an inline draft open: rejecting a switch must not commit or discard it.
    await page.keyboard.press('Escape');
    await page.locator('[data-id="note"]').dblclick();
    await page.locator('.inline-editor textarea').fill('Unsaved draft');
    await openLanguage();
    await page.locator('#ui-language').selectOption('en');
    assert.equal(await page.locator('#ui-language').inputValue(), 'ja');
    assert.equal(await page.locator('.inline-editor textarea').inputValue(), 'Unsaved draft');
    assert.deepEqual(await call('desk_state'), before);
    assert.match(await page.locator('#desk-menu-panel [role="status"]').textContent() ?? '', /操作/);
    await page.keyboard.press('Escape');
    await page.locator('.inline-editor textarea').focus();
    await page.keyboard.press('Escape');
    await openLanguage();
    await page.locator('#ui-language').selectOption('en');
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    assert.deepEqual(await call('desk_state'), before);
    assert.deepEqual(await call('desk_camera_get'), camera);
    const afterEditing = await call('desk_selection');
    // Double-clicking the card moves the human pointer, independently of language switching.
    assert.deepEqual(afterEditing.ids, selection.ids);
    assert.deepEqual(afterEditing.aiPointing, selection.aiPointing);
    await page.keyboard.press('Escape');
    await page.reload();
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    assert.equal(await page.locator('#undo').getAttribute('aria-label'), 'Undo');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('language switching still works when browser preference storage is unavailable', { timeout: 30_000 }, async () => {
  const { page, close, errors } = await openTestDesk('ui-language-no-storage', `
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
  `);
  try {
    assert.equal(await page.locator('html').getAttribute('lang'), 'ja');
    await page.locator('#desk-menu').click();
    await page.locator('#desk-menu-panel > .desk-menu-item').nth(1).click();
    await page.locator('#ui-language').selectOption('en');
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    assert.equal(await page.locator('#undo').getAttribute('aria-label'), 'Undo');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
