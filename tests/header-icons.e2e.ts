import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';

test('header actions use monochrome accessible icons with tooltips and keep their behavior', { timeout: 30_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('header-icons');
  try {
    for (const [id, label] of [['undo', '元に戻す'], ['redo', 'やり直す'], ['save-desk', '保存'], ['load-desk', '読込']]) {
      const button = page.getByRole('button', { name: label, exact: true });
      assert.equal(await button.getAttribute('id'), id);
      assert.equal(await button.getAttribute('title'), label);
      assert.equal((await button.textContent())?.trim(), '');
      const icon = button.locator('svg');
      assert.equal(await icon.getAttribute('aria-hidden'), 'true');
      assert.equal(await icon.getAttribute('stroke'), 'currentColor');
      assert.equal(await icon.getAttribute('fill'), 'none');
      assert.equal(await icon.getAttribute('stroke-width'), '1');
      const frame = (await button.boundingBox())!;
      assert.equal(frame.width, 36); assert.equal(frame.height, 36);
      // Inherited CSS color, rather than an emoji palette or hard-coded light/dark stroke.
      const colors = await button.evaluate(element => {
        const original = element.style.color;
        element.style.color = 'rgb(12, 34, 56)';
        const stroke = getComputedStyle(element.querySelector('svg')!).stroke;
        element.style.color = original;
        return stroke;
      });
      assert.equal(colors, 'rgb(12, 34, 56)');
    }
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'test', type: 'rect' } }] });
    await page.getByRole('button', { name: '元に戻す', exact: true }).click();
    assert.equal((await call('desk_summary')).count, 0);
    await page.getByRole('button', { name: 'やり直す', exact: true }).click();
    assert.equal((await call('desk_summary')).count, 1);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    assert.equal((await download).suggestedFilename(), '無題.tabletop');
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: '読込', exact: true }).click();
    assert.equal((await chooser).isMultiple(), false);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
