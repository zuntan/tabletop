import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';

test('object-list selection scrolls only once per selection change and targets the topmost selected row', { timeout: 30_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('object-list-selection-scroll');
  try {
    await call('desk_execute', { operations: Array.from({ length: 55 }, (_, index) => ({
      kind: 'add', object: { id: `object-${index}`, type: 'rect', x: index * 10, y: index * 5, text: `Object ${index}` },
    })) });
    const panel = page.locator('#panel-objects');
    assert.equal(await panel.evaluate(element => element.scrollTop), 0);
    await call('desk_select', { ids: ['object-0'] });
    await page.locator('#tab-objects').click();
    await page.waitForFunction(() => {
      const panel = document.querySelector('#panel-objects') as HTMLElement | null;
      const row = document.querySelector('#object-list .object-row.active');
      if (!panel || !row || panel.hidden) return false;
      const bounds = row.getBoundingClientRect();
      const top = panel.getBoundingClientRect().top + panel.clientTop;
      return bounds.top >= top && bounds.bottom <= top + panel.clientHeight;
    });
    assert.ok(await panel.evaluate(element => element.scrollTop > 0));
    const previousOffset = await panel.evaluate(element => element.scrollTop);
    await call('desk_select', { ids: ['object-54'] });
    const selectedTopRow = page.locator('#object-list .object-row.active').first();
    assert.ok((await panel.evaluate(element => element.scrollTop)) < previousOffset);
    assert.equal(await selectedTopRow.evaluate(element => {
      const row = element.getBoundingClientRect(), container = element.closest('.sidebar-panel') as HTMLElement;
      const top = container.getBoundingClientRect().top + container.clientTop;
      return row.top >= top && row.bottom <= top + container.clientHeight;
    }), true);
    await panel.evaluate(element => { element.scrollTop = 300; });
    await page.locator('#object-list .object-row.active').first().evaluate(element => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    assert.equal(await panel.evaluate(element => element.scrollTop), 300);
    await page.locator('#tab-properties').click();
    await call('desk_select', { ids: ['object-0'] });
    await call('desk_select', { ids: ['object-54'] });
    await page.locator('#tab-objects').click();
    await page.waitForFunction(() => {
      const panel = document.querySelector('#panel-objects') as HTMLElement | null;
      const row = document.querySelector('#object-list .object-row.active');
      if (!panel || !row || panel.hidden) return false;
      const bounds = row.getBoundingClientRect();
      const top = panel.getBoundingClientRect().top + panel.clientTop;
      return bounds.top >= top && bounds.bottom <= top + panel.clientHeight;
    });
    assert.ok((await panel.evaluate(element => element.scrollTop)) < 300);

    await call('desk_select', { ids: ['object-0'] });
    const target = page.locator('#object-list .object-row.active').first();
    assert.match(await target.innerText(), /Object 0/);
    assert.equal(await target.evaluate(element => {
      const row = element.getBoundingClientRect(), container = element.closest('.sidebar-panel') as HTMLElement;
      const top = container.getBoundingClientRect().top + container.clientTop;
      return row.top >= top && row.bottom <= top + container.clientHeight;
    }), true);
    await panel.evaluate(element => { element.scrollTop = 0; });
    await target.evaluate(element => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    assert.equal(await panel.evaluate(element => element.scrollTop), 0);

    await call('desk_select', { ids: ['object-0', 'object-54'] });
    assert.match(await page.locator('#object-list .object-row.active').first().innerText(), /Object 54/);
    assert.equal(await panel.evaluate(element => element.scrollTop), 0);
    await panel.evaluate(element => { element.scrollTop = 250; });
    await call('desk_select', { ids: [] });
    assert.equal(await panel.evaluate(element => element.scrollTop), 250);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
