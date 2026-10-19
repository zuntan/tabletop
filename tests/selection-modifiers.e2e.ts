import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';

test('Shift and Ctrl both toggle individual selections and add marquee ranges on canvas and list', { timeout: 30_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('selection-modifiers');
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await call('desk_execute', { operations: ['a', 'b', 'c'].map((key, index) => ({ kind: 'add', object: { id: `pick-${key}`, type: 'rect', x: 100 + index * 200, y: 100, width: 80, height: 60, locked: true } })) });
    const before = await call('desk_state');
    async function point(x: number, y: number) {
      return page.locator('#viewport').evaluate((el, p) => {
        const matrix = (el as unknown as SVGGElement).getScreenCTM()!;
        const result = new DOMPoint(p.x, p.y).matrixTransform(matrix); return { x: result.x, y: result.y };
      }, { x, y });
    }
    async function selected(ids: string[]) { assert.deepEqual((await call('desk_selection')).ids.sort(), ids.sort()); }
    for (const key of ['Shift', 'Control']) {
      await call('desk_select', { ids: ['pick-a'] });
      await page.keyboard.down(key);
      const b = await point(340, 130); await page.mouse.click(b.x, b.y);
      await selected(['pick-a', 'pick-b']);
      const a = await point(140, 130); await page.mouse.click(a.x, a.y);
      await selected(['pick-b']);
      await page.keyboard.up(key);
      await call('desk_select', { ids: ['pick-a'] });
      const from = await point(280, 80), to = await point(600, 180);
      await page.keyboard.down(key); await page.mouse.move(from.x, from.y); await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 5 }); await page.mouse.up(); await page.keyboard.up(key);
      await selected(['pick-a', 'pick-b', 'pick-c']);
    }
    await call('desk_select', { ids: ['pick-a'] });
    const a = await point(140, 130);
    await page.keyboard.down('Shift'); await page.keyboard.down('Control'); await page.mouse.click(a.x, a.y);
    await page.keyboard.up('Control'); await page.keyboard.up('Shift'); await selected([]);
    await page.locator('#tab-objects').click();
    for (const key of ['Shift', 'Control']) {
      await call('desk_select', { ids: ['pick-a'] });
      await page.locator('.object-row').filter({ hasText: 'pick-b' }).click({ modifiers: [key as 'Shift' | 'Control'] });
      await selected(['pick-a', 'pick-b']);
      await page.locator('.object-row').filter({ hasText: 'pick-a' }).click({ modifiers: [key as 'Shift' | 'Control'] });
      await selected(['pick-b']);
    }
    const after = await call('desk_state');
    assert.equal(after.revision, before.revision); assert.deepEqual(after.objects, before.objects);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
