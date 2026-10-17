import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';

test('object filters categorize rows and scroll only when the applied result contains the selection', { timeout: 45_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('object-filter');
  try {
    const operations: Record<string, unknown>[] = [
      { kind: 'series_add', series: { id: 'filter-series', name: 'Filter test' } },
      { kind: 'label_add', id: 'filter-pin', seriesId: 'filter-series', x: 0, y: 0 },
      ...[
        ['filter-text', 'text'], ['filter-rect', 'rect'], ['filter-rounded', 'roundedRect'], ['filter-ellipse', 'ellipse'],
        ['filter-line', 'line'], ['filter-arrow', 'arrow'], ['filter-image', 'image'], ['filter-svg', 'svg'],
        ['filter-web', 'web'], ['filter-link', 'link'],
      ].map(([id, type]) => {
        const object: Record<string, unknown> = { id, type, text: id, url: 'https://example.invalid', height: 34 };
        if (type === 'image' || type === 'svg') object.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/X1sAAAAASUVORK5CYII=';
        return { kind: 'add', object };
      }),
      ...Array.from({ length: 20 }, (_, index) => ({ kind: 'add', object: { id: `filter-extra-${index}`, type: 'rect', text: `extra-${index}`, height: 35 } })),
    ];
    await call('desk_execute', { operations });
    await page.locator('#tab-objects').click();
    const panel = page.locator('#panel-objects');
    const rowCount = () => page.locator('#object-list .object-row').count();
    const categories = ['pins', 'text', 'shapes', 'lines', 'images', 'other'];
    const expectedCounts = [1, 2, 25, 27, 29, 31];
    assert.equal(await rowCount(), 31);
    assert.equal(await page.locator('#count').textContent(), '31');

    await page.locator('#object-filter-apply').click();
    assert.equal(await rowCount(), 1);
    await page.locator('#object-filter-all-on').click();
    assert.equal(await rowCount(), 31);
    assert.equal(await page.locator('#object-filter-apply').getAttribute('aria-checked'), 'true');
    await page.locator('#object-filter-all-off').click();
    assert.equal(await page.locator('#object-filter-apply').getAttribute('aria-checked'), 'true');
    assert.equal(await rowCount(), 0);
    assert.deepEqual(await page.locator('.object-filter-categories button').evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-pressed'))), Array(6).fill('false'));
    for (let index = 0; index < categories.length; index++) {
      await page.locator(`#object-filter-${categories[index]}`).click();
      assert.equal(await rowCount(), expectedCounts[index], `unexpected count for ${categories[index]}`);
    }
    assert.equal(await rowCount(), 31);

    await call('desk_select', { ids: ['filter-pin'] });
    await page.waitForFunction(() => {
      const panel = document.querySelector('#panel-objects') as HTMLElement;
      const row = document.querySelector('#object-list .object-row.active');
      if (!row) return false;
      const bounds = row.getBoundingClientRect(), top = panel.getBoundingClientRect().top + panel.clientTop;
      return bounds.top >= top && bounds.bottom <= top + panel.clientHeight;
    });

    await panel.evaluate(element => { element.scrollTop = 0; });
    await page.locator('#object-filter-apply').click();
    assert.equal(await page.locator('#object-filter-apply').getAttribute('aria-checked'), 'false');
    assert.equal(await rowCount(), 31);
    assert.equal(await page.locator('#object-list .object-row.active').evaluate(row => {
      const bounds = row.getBoundingClientRect(), panel = row.closest('.sidebar-panel') as HTMLElement;
      const top = panel.getBoundingClientRect().top + panel.clientTop;
      return bounds.top >= top && bounds.bottom <= top + panel.clientHeight;
    }), true);

    await panel.evaluate(element => { element.scrollTop = 0; });
    await page.locator('#object-filter-all-off').click();
    assert.equal(await rowCount(), 31);
    assert.equal(await panel.evaluate(element => element.scrollTop), 0);
    await page.locator('#object-filter-all-on').click();
    assert.equal(await page.locator('#object-filter-apply').getAttribute('aria-checked'), 'false');
    assert.equal(await panel.evaluate(element => element.scrollTop), 0);

    await page.locator('#object-filter-apply').click();
    assert.equal(await page.locator('#object-filter-apply').getAttribute('aria-checked'), 'true');
    assert.equal(await page.locator('#object-list .object-row.active').count(), 1);
    assert.equal(await page.locator('#object-list .object-row.active').evaluate(row => {
      const bounds = row.getBoundingClientRect(), panel = row.closest('.sidebar-panel') as HTMLElement;
      const top = panel.getBoundingClientRect().top + panel.clientTop;
      return bounds.top >= top && bounds.bottom <= top + panel.clientHeight;
    }), true);

    await panel.evaluate(element => { element.scrollTop = 0; });
    await page.locator('#object-filter-pins').click();
    assert.equal(await page.locator('#object-list .object-row.active').count(), 0);
    assert.equal(await panel.evaluate(element => element.scrollTop), 0);
    await page.locator('#object-filter-pins').click();
    assert.equal(await page.locator('#object-list .object-row.active').count(), 1);
    assert.equal(await page.locator('#object-list .object-row.active').evaluate(row => {
      const bounds = row.getBoundingClientRect(), panel = row.closest('.sidebar-panel') as HTMLElement;
      const top = panel.getBoundingClientRect().top + panel.clientTop;
      return bounds.top >= top && bounds.bottom <= top + panel.clientHeight;
    }), true);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
