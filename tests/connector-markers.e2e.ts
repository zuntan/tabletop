import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';

test('endpoint palettes support opposite arrows, circle and diamond, copy and Undo', { timeout: 40_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('connector-markers');
  page.setDefaultTimeout(5000);
  try {
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'edge', type: 'arrow', x: 100, y: 100, x2: 400, y2: 100 } }] });
    await call('desk_select', { ids: ['edge'] });
    assert.equal((await call('desk_get', { id: 'edge' })).type, 'line');
    async function choose(name: string, value: string) {
      await page.locator('#properties').getByRole('button', { name: `${name}の候補`, exact: true }).click();
      await page.getByRole('dialog', { name: `${name}の候補`, exact: true }).getByRole('button', { name: value, exact: true }).click();
    }
    await choose('始点形状', '矢印');
    assert.equal(await page.locator('[data-id="edge"] .arrow-head').count(), 2);
    assert.match(await page.locator('[data-id="edge"] [data-marker-side="start"]').getAttribute('points') ?? '', /^0,0 /);
    assert.match(await page.locator('[data-id="edge"] [data-marker-side="end"]').getAttribute('points') ?? '', /^300,0 /);
    await choose('終点形状', 'なし');
    assert.equal(await page.locator('[data-id="edge"] .arrow-head').count(), 1);
    await choose('始点形状', '丸'); await choose('終点形状', 'ひし形');
    assert.equal(await page.locator('[data-id="edge"] circle.connector-marker').count(), 1);
    assert.equal(await page.locator('[data-id="edge"] polygon[data-marker-shape="diamond"]').count(), 1);
    await call('desk_undo');
    assert.equal((await call('desk_get', { id: 'edge' })).endMarker, 'none');
    await call('desk_redo');
    await page.locator('#canvas').focus(); await page.keyboard.press('Control+c'); await page.keyboard.press('Control+v');
    await page.waitForFunction(() => document.querySelectorAll('#objects > [data-id]').length === 2);
    const state = await call('desk_state');
    for (const object of state.objects) {
      assert.equal(object.type, 'line'); assert.equal(object.startMarker, 'circle'); assert.equal(object.endMarker, 'diamond');
    }
    await call('desk_select', { ids: [] });
    await page.locator('[data-add="arrow"]').click();
    const added = (await call('desk_state')).objects.at(-1);
    assert.equal(added.type, 'line'); assert.equal(added.startMarker, 'none'); assert.equal(added.endMarker, 'arrow');
    await page.locator('[data-add="line"]').click();
    const plain = (await call('desk_state')).objects.at(-1);
    assert.equal(plain.type, 'line'); assert.equal(plain.startMarker, 'none'); assert.equal(plain.endMarker, 'none');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
