import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';

test('native copy/cut/paste and toolbar paste preserve local parts while exporting plain text', { timeout: 30_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('part-clipboard-native');
  try {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await call('desk_execute', { operations: [
      { kind: 'add', object: { id: 'memo', type: 'text', x: 100, y: 100, text: 'Copy this note', fill: '#fde68a' } },
      { kind: 'add', object: { id: 'shape', type: 'rect', x: 400, y: 100, text: 'Shape text' } },
    ] });
    await call('desk_select', { ids: ['memo', 'shape'] });
    await page.locator('#canvas').focus();
    await page.keyboard.press('Control+c');
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'Copy this note\n\nShape text');
    await page.keyboard.press('Control+v');
    assert.equal((await call('desk_summary')).count, 4);
    const pasted = (await call('desk_selection')).ids as string[];
    assert.equal(pasted.length, 2); assert.ok(pasted.every(id => !['memo', 'shape'].includes(id)));
    assert.equal((await call('desk_get', { id: pasted[0] })).fill, '#fde68a');
    assert.equal((await call('desk_get', { id: pasted[0] })).x, 124);
    await page.keyboard.press('Control+x');
    assert.equal((await call('desk_summary')).count, 2);
    await page.locator('#clipboard').click();
    await page.waitForFunction(() => document.querySelectorAll('#objects > g').length === 4);
    assert.equal((await call('desk_summary')).count, 4);
    await call('desk_undo'); assert.equal((await call('desk_summary')).count, 2);
    await call('desk_undo'); assert.equal((await call('desk_summary')).count, 4);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('external strings stay text except a standalone URL and editor clipboard remains native', { timeout: 30_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('part-clipboard-strings');
  try {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    for (const [value, type] of [['①', 'text'], ['https://example.test/path?q=1', 'link'], ['See https://example.test', 'text']]) {
      await page.evaluate(value => navigator.clipboard.writeText(value), value);
      await page.locator('#canvas').focus();
      await page.keyboard.press('Control+v');
      const id = (await call('desk_selection')).ids[0];
      const part = await call('desk_get', { id });
      assert.equal(part.type, type); assert.equal(part.text, value);
    }
    const before = await call('desk_summary');
    const id = (await call('desk_selection')).ids[0];
    await page.locator(`[data-id="${id}"] .markdown-text`).dblclick();
    const editor = page.locator('[data-inline-text]');
    await editor.fill('Editable text'); await editor.selectText();
    await page.keyboard.press('Control+c');
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'Editable text');
    await page.keyboard.press('Control+x'); assert.equal(await editor.inputValue(), '');
    await page.keyboard.press('Control+v'); assert.equal(await editor.inputValue(), 'Editable text');
    assert.equal((await call('desk_summary')).revision, before.revision);
    await editor.press('Escape');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
