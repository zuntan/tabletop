import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDesk } from './desk-browser';

test('held Markdown draft preview matches the resized field, clips, and never commits; Enter preference survives reload', { timeout: 60_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('markdown-preview', `
    if (!localStorage.getItem('tabletop.editor.submit-key')) localStorage.setItem('tabletop.editor.submit-key','mod-enter');
    localStorage.setItem('tabletop-ui-theme','dark');
  `);
  try {
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'memo', type: 'text', x: 200, y: 100, width: 480, height: 240, text: 'Original', fill: '#ff0000', textColor: '#00ff00' } }] });
    await page.locator('[data-id="memo"] .markdown-text').dblclick();
    const input = page.locator('[data-inline-text]'), mode = page.getByRole('button', { name: 'Enter改行モード' });
    assert.equal(await mode.getAttribute('aria-pressed'), 'true');
    const draft = '# Draft\n\n**bold**\n\n- item\n\n<script>not executable</script>\n\n' + 'more\n'.repeat(60);
    await input.fill(draft);
    await input.evaluate(e => { e.style.height = '180px'; e.style.width = '520px'; });
    const button = page.getByRole('button', { name: 'Markdownプレビュー', exact: true });
    const preview = page.locator('.editor-markdown-preview');
    const rect = await button.boundingBox(); assert.ok(rect);
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down();
    assert.equal(await preview.isVisible(), true);
    assert.equal(await preview.locator('h1').textContent(), 'Draft');
    assert.equal(await preview.locator('strong').textContent(), 'bold');
    assert.equal(await preview.locator('script').count(), 0);
    const layout = await preview.evaluate(e => {
      const input = document.querySelector('[data-inline-text]')!, a = e.getBoundingClientRect(), b = input.getBoundingClientRect();
      const x = getComputedStyle(e), y = getComputedStyle(input);
      return { sameRect: ['x','y','width','height'].every(k => Math.abs(a[k as keyof DOMRect] as number - (b[k as keyof DOMRect] as number)) < 1),
        sameColors: x.backgroundColor === y.backgroundColor && x.color === y.color && x.borderColor === y.borderColor,
        clipped: e.scrollHeight > e.clientHeight && x.overflow === 'hidden' };
    });
    assert.deepEqual(layout, { sameRect: true, sameColors: true, clipped: true });
    assert.equal((await call('desk_get', { id: 'memo' })).text, 'Original');
    await page.mouse.move(1100, 900); await page.mouse.up(); // Capture ends the preview even outside the button.
    assert.equal(await preview.isVisible(), false); assert.equal(await input.inputValue(), draft);
    assert.equal(await input.evaluate(e => e === document.activeElement), true);
    assert.equal(await button.locator('[data-icon="eye"]').count(), 1);
    await button.focus(); await page.keyboard.down('Space'); assert.equal(await preview.isVisible(), true);
    await page.keyboard.up('Space'); assert.equal(await preview.isVisible(), false);
    assert.equal(await input.evaluate(e => e === document.activeElement), true);
    await button.focus(); await page.keyboard.down('Space');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    assert.equal(await preview.isVisible(), false); await page.keyboard.up('Space');
    await mode.click(); assert.equal(await page.evaluate(() => localStorage.getItem('tabletop.editor.submit-key')), 'enter');
    await input.press('Escape'); assert.equal((await call('desk_get', { id: 'memo' })).text, 'Original');
    await page.reload(); await page.locator('[data-add="text"]').click();
    assert.equal(await mode.getAttribute('aria-pressed'), 'false');
    await page.locator('[data-inline-text]').press('Escape');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
