import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDesk } from './desk-browser';
import { reactionChoices } from '../src/reaction-values';

test('middle toolbar shows seven quick reactions and a persistent three-row keyboard-friendly palette', { timeout: 45_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('reaction-picker');
  try {
    const more = page.getByRole('button', { name: 'リアクション一覧', exact: true });
    const palette = page.locator('#reaction-palette');
    assert.equal(await page.locator('nav > .toolbar-group').count(), 3);
    assert.equal(await page.locator('nav #authoring-tools #reaction-controls').count(), 1);
    assert.equal(await page.locator('aside #reaction-controls').count(), 0);
    assert.equal(await page.locator('.reaction-quick [data-reaction]').count(), 7);
    assert.equal(await more.isDisabled(), true); assert.equal(await palette.isVisible(), false);
    await call('desk_execute', { operations: [{ kind: 'add', object: {
      id: 'memo', type: 'text', text: 'Memo', x: 200, y: 160, reactions: ['✅', '💡'],
    } }] });
    await call('desk_select', { ids: ['memo'] });
    assert.equal(await page.locator('.reaction-quick [data-reaction="✔"]').getAttribute('aria-pressed'), 'true');
    assert.deepEqual((await call('desk_get', { id: 'memo' })).reactions, ['✅', '💡']);
    await more.click(); await palette.waitFor({ state: 'visible' });
    assert.equal(await palette.locator('[data-reaction]').count(), 18);
    assert.deepEqual(await palette.locator('[data-reaction]').allTextContents(), [...reactionChoices]);
    assert.equal(await palette.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length), 7);
    const first = (await palette.locator('[data-reaction="👍"]').boundingBox())!;
    const second = (await palette.locator('[data-reaction="👀"]').boundingBox())!;
    const third = (await palette.locator('[data-reaction="📌"]').boundingBox())!;
    assert.equal(first.x, second.x); assert.equal(first.x, third.x);
    assert.ok(first.y < second.y && second.y < third.y);
    const smile = palette.getByRole('button', { name: '😊 にっこり', exact: true });
    await smile.click();
    assert.deepEqual((await call('desk_get', { id: 'memo' })).reactions, ['✅', '💡', '😊']);
    assert.equal(await palette.isVisible(), true);
    assert.equal(await smile.getAttribute('aria-pressed'), 'true');
    assert.equal(await smile.evaluate(element => element === document.activeElement), true);
    await smile.press('Escape'); await palette.waitFor({ state: 'hidden' });
    assert.deepEqual((await call('desk_selection')).ids, ['memo']);
    assert.equal(await more.evaluate(element => element === document.activeElement), true);
    await more.press('Space'); await palette.waitFor({ state: 'visible' });
    await palette.getByRole('button', { name: '✔ チェック', exact: true }).click();
    assert.deepEqual((await call('desk_get', { id: 'memo' })).reactions, ['💡', '😊']);
    await page.locator('header .brand').click(); await palette.waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.querySelector('#reaction-more')?.getAttribute('aria-expanded') === 'false');
    await page.setViewportSize({ width: 390, height: 844 });
    await more.click(); await palette.waitFor({ state: 'visible' });
    const box = (await palette.boundingBox())!;
    assert.ok(box.x >= 0 && box.x + box.width <= 390);
    assert.ok(box.y >= 0 && box.y + box.height <= 844);
    await call('desk_select', { ids: [] }); await palette.waitFor({ state: 'hidden' });
    assert.equal(await more.isDisabled(), true);
    assert.equal(await page.locator('.reaction-quick [data-reaction]:disabled').count(), 7);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
