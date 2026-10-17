import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';

const view = (page: import('playwright').Page) => page.locator('#viewport').getAttribute('transform');

test('object-list focus flies, replaces the destination and hands control back on human input', { timeout: 30_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('human-focus-flight');
  try {
    await call('desk_execute', { operations: [
      { kind: 'add', object: { id: 'far', type: 'rect', x: 10000, y: 5000, width: 200, height: 100, text: 'Far target' } },
      { kind: 'add', object: { id: 'other', type: 'rect', x: -10000, y: -5000, width: 200, height: 100, text: 'Other target' } },
    ] });
    const revision = (await call('desk_summary')).revision;
    await page.locator('#tab-objects').click();
    const before = await view(page);
    await page.getByRole('button', { name: '矩形 · Far target', exact: true }).click();
    await page.waitForFunction(before => document.querySelector('#viewport')?.getAttribute('transform') !== before, before);
    const middle = await call('desk_camera_get');
    assert.notEqual(middle.center.x, 10100, 'focus must expose intermediate frames');
    await page.getByRole('button', { name: '矩形 · Other target', exact: true }).click();
    await page.waitForFunction(() => {
      const m = (document.querySelector('#viewport') as unknown as SVGGElement).transform.baseVal.consolidate()!.matrix;
      const canvas = document.querySelector('#canvas') as SVGSVGElement;
      return Math.abs((canvas.clientWidth / 2 - m.e) / m.a + 9900) < 0.01 && m.a === 2;
    });
    assert.deepEqual((await call('desk_selection')).ids, ['other']);
    assert.equal((await call('desk_summary')).revision, revision);

    await page.getByRole('button', { name: '矩形 · Far target', exact: true }).click();
    await page.waitForTimeout(120);
    await page.locator('#canvas').dispatchEvent('pointerdown', { button: 1, pointerId: 1 });
    await page.locator('#canvas').dispatchEvent('pointerup', { button: 1, pointerId: 1 });
    const stopped = await view(page);
    await page.waitForTimeout(1000);
    assert.equal(await view(page), stopped, 'cancelled focus must not resume');
    assert.equal(await page.locator('#message.error').count(), 0);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: '矩形 · Far target', exact: true }).click();
    await page.waitForFunction(() => {
      const m = (document.querySelector('#viewport') as unknown as SVGGElement).transform.baseVal.consolidate()!.matrix;
      const canvas = document.querySelector('#canvas') as SVGSVGElement;
      return Math.abs((canvas.clientWidth / 2 - m.e) / m.a - 10100) < 0.01 && m.a === 2;
    });
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
