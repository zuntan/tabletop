import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDesk } from './desk-browser';

test('left toolbar exposes absolute stacking actions and reactions without changing shared Undo', { timeout: 45_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('toolbar-actions');
  try {
    assert.equal(await page.locator('#authoring-tools #front').count(), 1);
    assert.equal(await page.locator('#authoring-tools #back').count(), 1);
    assert.equal(await page.locator('.toolbar-parts #reaction-more').count(), 1);
    assert.equal(await page.locator('aside #front, aside #back').count(), 0);
    assert.equal(await page.locator('#authoring-tools #reaction-controls').count(), 0);
    assert.equal(await page.locator('aside #delete').count(), 1);
    const front = page.getByRole('button', { name: '最前面', exact: true });
    const back = page.getByRole('button', { name: '最背面', exact: true });
    assert.equal(await front.isDisabled(), true); assert.equal(await back.isDisabled(), true);
    assert.equal(await front.locator('.tool-caption').innerText(), '最前面');
    assert.equal(await back.locator('.tool-caption').innerText(), '最背面');
    await call('desk_execute', { operations: ['a', 'b', 'c'].map((id, index) => ({ kind: 'add', object: { id, type: 'rect', x: 200 + index * 50, y: 180 } })) });
    await call('desk_select', { ids: ['a'] });
    await front.click();
    assert.deepEqual((await call('desk_list')).objects.map((object: { id: string }) => object.id), ['b', 'c', 'a']);
    assert.deepEqual(await page.locator('#objects > [data-id]').evaluateAll(elements => elements.map(element => element.getAttribute('data-id'))), ['b', 'c', 'a']);
    await page.locator('#undo').click();
    assert.deepEqual((await call('desk_list')).objects.map((object: { id: string }) => object.id), ['a', 'b', 'c']);
    await call('desk_select', { ids: ['c'] }); await back.click();
    assert.deepEqual((await call('desk_list')).objects.map((object: { id: string }) => object.id), ['c', 'a', 'b']);
    await page.locator('#undo').click(); await call('desk_select', { ids: ['a', 'b'] });
    await page.locator('#reaction-more').click(); await page.locator('[data-reaction="😊"]').click();
    const revision = (await call('desk_summary')).revision;
    await front.click(); assert.equal((await call('desk_summary')).revision, revision + 1);
    assert.deepEqual((await call('desk_list')).objects.map((object: { id: string }) => object.id), ['c', 'a', 'b']);
    assert.equal(await page.locator('#reaction-palette').isVisible(), true);
    assert.deepEqual((await call('desk_selection')).ids, ['a', 'b']);
    await back.click();
    assert.deepEqual((await call('desk_list')).objects.map((object: { id: string }) => object.id), ['a', 'b', 'c']);
    await page.locator('#undo').click();
    assert.deepEqual((await call('desk_list')).objects.map((object: { id: string }) => object.id), ['c', 'a', 'b']);
    assert.deepEqual((await call('desk_get', { id: 'a' })).reactions, ['😊']);
    await call('desk_select', { ids: [] });
    assert.equal(await front.isDisabled(), true); assert.equal(await back.isDisabled(), true);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('toolbar color captions sit below their swatches inside buttons while property details remain', { timeout: 45_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('color-captions');
  try {
    for (const [role, caption] of [['fill', '塗り'], ['stroke', '輪郭'], ['text', '文字']]) {
      const button = page.locator(`[data-color-role="default-${role}"]`);
      assert.equal(await button.locator(':scope > .tool-caption').innerText(), caption);
      assert.equal(await button.locator('..').locator(':scope > span').count(), 0);
      assert.equal(await button.locator('.color-value').isVisible(), false);
      const dot = (await button.locator('.color-dot').boundingBox())!;
      const label = (await button.locator('.tool-caption').boundingBox())!;
      assert.ok(label.y >= dot.y + dot.height);
    }
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'rect', type: 'rect' } }] });
    await call('desk_select', { ids: ['rect'] });
    const fill = page.locator('[data-color-role="default-fill"]');
    await fill.click();
    await page.locator('.palette-default-fill').getByRole('button',{name:'全色',exact:true}).click();
    await page.locator('.palette-default-fill').getByRole('button', { name: '塗り #f87171', exact: true }).click();
    assert.equal((await call('desk_get', { id: 'rect' })).fill, '#f87171');
    assert.equal((await call('desk_settings')).defaults.fill, '#f87171');
    assert.equal(await fill.getAttribute('title'), '塗りの色：#f87171');
    assert.equal(await fill.locator('.tool-caption').innerText(), '塗り');
    const detailed = page.locator('#color-controls [data-color-role="fill"]');
    assert.equal(await detailed.locator('.color-value').isVisible(), true);
    assert.equal(await detailed.locator('.color-value').innerText(), '#f87171');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
