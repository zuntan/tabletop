import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';

test('numeric preset menus preserve direct input, property drafts, pin series and undo', { timeout: 30_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('number-presets');
  page.setDefaultTimeout(5000);
  async function choose(scope: ReturnType<typeof page.locator>, name: string, value: string) {
    await scope.getByRole('button', { name, exact: true }).click();
    await page.getByRole('dialog', { name, exact: true }).getByRole('button', { name: value, exact: true }).click();
  }
  try {
    await choose(page.locator('#authoring-tools'), '線幅の候補', '8');
    assert.equal((await call('desk_settings')).defaults.strokeWidth, 8);
    await page.locator('#default-width').fill('1.5');
    await page.locator('#default-width').press('Tab');
    assert.equal((await call('desk_settings')).defaults.strokeWidth, 1.5);
    await choose(page.locator('#authoring-tools'), '塗り透過（%）の候補', '100');
    assert.equal((await call('desk_settings')).defaults.fillOpacity, 0);
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'card', type: 'text', text: 'Memo' } }] });
    await call('desk_select', { ids: ['card'] });
    const properties = page.locator('#properties');
    await choose(properties, '内側の余白の候補', '32');
    await choose(properties, '角丸の候補', '16');
    await choose(properties, '文字サイズの候補', '48');
    assert.equal(await properties.locator('[name="padding"]').inputValue(), '32');
    await properties.getByRole('button', { name: '変更を適用' }).click();
    assert.equal(await properties.evaluate(el => (el as HTMLFormElement).checkValidity()), true,
      JSON.stringify(await properties.locator(':invalid').evaluateAll(els => els.map(el => ({ name: (el as HTMLInputElement).name, value: (el as HTMLInputElement).value })))));
    const card = await call('desk_get', { id: 'card' });
    assert.equal(card.padding, 32); assert.equal(card.cornerRadius, 16); assert.equal(card.fontSize, 48);
    await call('desk_undo'); assert.notEqual((await call('desk_get', { id: 'card' })).padding, 32);
    await call('desk_execute', { operations: [{ kind: 'label_add', id: 'pin', seriesId: 'series-1', x: 500, y: 500 }] });
    await call('desk_select', { ids: ['pin'] });
    assert.equal(await properties.getByRole('button', { name: '線幅の候補', exact: true }).isDisabled(), true);
    const series = page.locator('#series-settings');
    await choose(series.locator('label').filter({ has: page.locator('[name="strokeWidth"]') }), '線幅の候補', '4');
    await choose(series.locator('fieldset'), '塗り透過（%）の候補', '70');
    const settings = await call('desk_settings');
    assert.equal(settings.series[0].strokeWidth, 4);
    assert.ok(Math.abs(settings.series[0].thread.opacity - 0.3) < 1e-9);
    await choose(series, '線種の候補', '破線');
    assert.equal((await call('desk_settings')).series[0].thread.dash, 'dashed');
    const lineStyle = series.getByRole('button', { name: '線種の候補', exact: true });
    assert.match(await lineStyle.innerText(), /破線/);
    assert.equal(await lineStyle.locator('line').getAttribute('stroke-dasharray'), '8 5');
    await call('desk_undo');
    assert.match(await lineStyle.innerText(), /実線/);
    for (const width of [1400, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const trigger = page.locator('#authoring-tools').getByRole('button', { name: '線幅の候補', exact: true });
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: '線幅の候補', exact: true });
      const rect = (await dialog.boundingBox())!;
      assert.ok(rect.x >= 0 && rect.x + rect.width <= width);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.number-preset-palette:popover-open'));
      await page.waitForFunction(() => !document.querySelector('.number-preset-menu[aria-expanded="true"]'));
      assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
      assert.equal(await dialog.isVisible(), false);
    }
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
