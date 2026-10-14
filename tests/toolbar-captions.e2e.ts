import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDesk } from './desk-browser';

test('toolbar captions stay visible and flexible groups keep editing actions together', { timeout: 45_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('toolbar-captions');
  try {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const tools = page.locator('nav .tool-button'); assert.ok(await tools.count() >= 18);
    assert.deepEqual(await page.locator('.toolbar-parts > button').evaluateAll(elements => elements.map(element => element.getAttribute('data-add') || element.id)),
      ['selection-mode', 'rect', 'roundedRect', 'ellipse', 'line', 'arrow', 'numbering', 'text', 'image', 'web', 'link', 'clipboard']);
    for (const button of await tools.all()) {
      assert.equal(await button.locator('.tool-caption').isVisible(), true);
      assert.ok((await button.locator('.tool-caption').innerText()).length > 0);
      assert.ok(await button.getAttribute('aria-label'));
    }
    assert.equal(await page.locator('[data-add="rect"] .tool-caption').innerText(), '矩形');
    assert.equal(await page.locator('[data-add="web"] .tool-caption').innerText(), 'Web資料');
    assert.equal(await page.locator('#numbering-settings .tool-caption').innerText(), 'ピン設定');
    const rows = await page.locator('.toolbar-parts .tool-button').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top));
    assert.equal(new Set(rows).size, 1);
    const centerRows = await page.locator('#authoring-tools > *').evaluateAll(elements => elements.map(element => Math.round(element.getBoundingClientRect().top + element.getBoundingClientRect().height / 2)));
    assert.equal(new Set(centerRows).size, 1);
    const back = (await page.locator('#back').boundingBox())!;
    const reaction = (await page.locator('#reaction-more').boundingBox())!;
    assert.equal(back.y, reaction.y); assert.ok(reaction.x > back.x);
    assert.ok(reaction.x - back.x - back.width < 10);
    await page.locator('#zoom-in').click();
    assert.equal(await page.locator('#zoom-reset .tool-icon').innerText(), '125%');
    assert.equal(await page.locator('#zoom-reset .tool-caption').innerText(), '100%へ');
    await page.locator('#zoom-reset').click();
    assert.equal(await page.locator('#zoom-reset .tool-icon').innerText(), '100%');
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'memo', type: 'text', x: 120, y: 120, text: 'Memo', reactions: ['○', '✕'] } }] });
    await call('desk_select', { ids: ['memo'] }); await page.locator('#reaction-more').click();
    assert.equal(await page.locator('[data-reaction="⭕"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('[data-reaction="❌"]').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(await page.locator('[data-reactions="memo"] text').allTextContents(), ['⭕', '❌']);
    assert.deepEqual((await call('desk_get', { id: 'memo' })).reactions, ['○', '✕']);
    await page.locator('#canvas').dispatchEvent('keydown', { key: 'Escape', isComposing: true });
    assert.equal(await page.locator('#reaction-palette').isVisible(), true);
    await page.locator('[data-id="memo"] .markdown-text').dblclick();
    await page.locator('[data-inline-text]').fill('Uncommitted');
    await page.locator('[data-inline-text]').press('Escape');
    assert.equal(await page.locator('.inline-editor').count(), 0);
    assert.equal(await page.locator('#reaction-palette').isVisible(), true);
    assert.equal((await call('desk_get', { id: 'memo' })).text, 'Memo');
    await page.locator('#canvas').focus(); await page.keyboard.press('Escape');
    assert.equal(await page.locator('#reaction-palette').isVisible(), false);
    assert.deepEqual((await call('desk_selection')).ids, ['memo']);
    for (const width of [1400, 850, 390]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await page.locator('#reaction-more').isVisible(), true);
      assert.equal(await page.locator('[data-add="text"] .tool-caption').isVisible(), true);
      const back = (await page.locator('#back').boundingBox())!;
      const trigger = (await page.locator('#reaction-more').boundingBox())!;
      assert.equal(back.y, trigger.y);
      await page.locator('#reaction-more').click();
      const palette = (await page.locator('#reaction-palette').boundingBox())!;
      assert.ok(palette.x >= 0 && palette.x + palette.width <= width);
      await page.keyboard.press('Escape');
    }
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
