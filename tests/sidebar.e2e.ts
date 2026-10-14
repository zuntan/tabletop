import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDesk } from './desk-browser';

test('sidebar tabs use full height, preserve tab/scroll and hide without changing desk state', { timeout: 45_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('sidebar-test');
  try {
    assert.equal(await page.getByRole('tab').count(), 4);
    assert.equal(await page.locator('#tab-properties').getAttribute('aria-selected'), 'true');
    for (let i = 0; i < 55; i++) await call('desk_execute', { operations: [{ kind: 'add', object: { id: `object-${i}`, type: 'rect', x: i * 10, y: i * 5, text: `Object ${i}` } }] });
    await page.locator('#tab-history').click();
    assert.equal(await page.locator('#history .history-row').count(), 50);
    const panel = page.locator('#panel-history');
    const dimensions = await panel.evaluate(element => ({ height: element.clientHeight, scroll: element.scrollHeight, aside: element.parentElement!.parentElement!.clientHeight }));
    assert.ok(dimensions.height > dimensions.aside - 65); assert.ok(dimensions.scroll > dimensions.height);
    await panel.evaluate(element => { element.scrollTop = 200; });
    const state = await call('desk_state'); const width = (await page.locator('#canvas').boundingBox())!.width;
    await page.locator('#sidebar-toggle').click();
    assert.equal(await page.locator('#sidebar').isVisible(), false);
    assert.ok((await page.locator('#canvas').boundingBox())!.width > width);
    assert.deepEqual(await call('desk_state'), state);
    await page.locator('#sidebar-toggle').click();
    assert.equal(await page.locator('#tab-history').getAttribute('aria-selected'), 'true');
    assert.equal(await panel.evaluate(element => element.scrollTop), 200);
    await page.locator('#tab-objects').click();
    assert.equal(await page.locator('#object-list .object-row').count(), 55);
    assert.equal(await page.locator('#object-list').evaluate(element => getComputedStyle(element).maxHeight), 'none');
    await page.locator('#tab-objects').focus(); await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#tab-history').getAttribute('aria-selected'), 'true');
    await page.keyboard.press('End'); assert.equal(await page.locator('#tab-connection').getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('#connect-form').isVisible(), true);
    await page.keyboard.press('Home'); assert.equal(await page.locator('#tab-properties').getAttribute('aria-selected'), 'true');
    await page.locator('#tab-history').click(); await page.locator('#sidebar-toggle').click();
    await page.locator('#numbering-settings').click();
    assert.equal(await page.locator('#sidebar').isVisible(), true);
    assert.equal(await page.locator('#series-panel').isVisible(), true);
    await page.setViewportSize({ width: 390, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.locator('#sidebar-toggle').click(); assert.equal(await page.locator('#sidebar').isVisible(), false);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
