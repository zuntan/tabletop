import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openTestDesk } from './desk-browser';

test('desk font UI applies to existing and new cards, code, preview, persistence and new desks', { timeout: 45_000 }, async () => {
  const { page, call, close, port, errors } = await openTestDesk('desk-fonts');
  const directory = await mkdtemp(join(tmpdir(), 'tabletop-fonts-'));
  try {
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'memo', type: 'text', x: 100, y: 100, width: 700, height: 500, text: '# 書体の見本\n\n本文 English\n\n`const value = 123;`' } }] });
    await page.locator('#desk-menu').click();
    await page.getByRole('button', { name: '机の見た目…' }).click();
    await page.locator('#card-body-font').selectOption('serif');
    await page.locator('#card-font-serif').fill('Georgia, "Noto Serif JP"');
    await page.locator('#card-font-serif').press('Tab');
    await page.locator('#card-font-monospace').fill('"Courier New"');
    await page.locator('#card-font-monospace').press('Tab');
    const body = page.locator('[data-id="memo"] .markdown-text');
    const family = await body.evaluate(element => getComputedStyle(element).fontFamily);
    assert.equal(family, 'Georgia, "Noto Serif JP", serif');
    assert.equal(await body.locator('code').evaluate(element => getComputedStyle(element).fontFamily), '"Courier New", monospace');
    await call('desk_undo');
    assert.equal(await body.locator('code').evaluate(element => getComputedStyle(element).fontFamily), 'monospace');
    await call('desk_redo');
    const prefs = await page.evaluate(() => localStorage.getItem('tabletop.font-defaults'));
    assert.ok(prefs?.includes('Georgia'));
    const invalidRevision = (await call('desk_summary')).revision;
    await page.locator('#card-font-serif').fill('Arial; color: red');
    await page.locator('#card-font-serif').press('Tab');
    assert.equal((await call('desk_summary')).revision, invalidRevision);
    await page.keyboard.press('Escape');
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'new-card', type: 'text', x: 850, y: 100, text: '新しいカード' } }] });
    assert.equal(await page.locator('[data-id="new-card"] .markdown-text').evaluate(element => getComputedStyle(element).fontFamily), family);
    await page.locator('[data-id="memo"] h1').dblclick();
    assert.equal(await page.locator('[data-inline-text]').evaluate(element => getComputedStyle(element).fontFamily), '"Courier New", monospace');
    const preview = page.locator('.inline-editor .editor-markdown-preview');
    await page.locator('.inline-editor .editor-preview-toggle').hover();
    await page.mouse.down();
    assert.equal(await preview.evaluate(element => getComputedStyle(element).fontFamily), family);
    await page.mouse.up();
    await page.locator('[data-inline-text]').press('Escape');
    const saved = await call('desk_save', { path: join(directory, 'fonts.tabletop') });
    const pdf = await call('desk_pdf', { path: join(directory, 'fonts.pdf') });
    assert.ok(pdf.bytes > 0);
    await call('desk_execute', { operations: [{ kind: 'fonts_update', patch: { body: 'monospace' } }] });
    const summary = await call('desk_summary');
    await call('desk_load', { path: saved.path, confirm: true, expectedRevision: summary.revision, expectedSessionId: summary.sessionId });
    assert.equal(await body.evaluate(element => getComputedStyle(element).fontFamily), family);
    // Loading a saved desk does not replace the last explicitly configured defaults.
    await page.goto(`http://127.0.0.1:${port}/?connect=off`);
    assert.equal(await page.locator('#app').evaluate(element => element.style.getPropertyValue('--card-font-family')), '"Courier New", monospace');
    assert.deepEqual(errors, []);
  } finally { await close(); await rm(directory, { recursive: true, force: true }); }
});
