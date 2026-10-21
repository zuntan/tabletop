import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDesk } from './desk-browser';
import { mkdir } from 'node:fs/promises';

test('stamp palette, arbitrary fallback text, selection retreat, resize and shared Undo', { timeout: 60_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('stamps');
  try {
    const patterns = await call('desk_stamp_patterns');
    assert.equal(patterns.patterns.length, 15); assert.equal(patterns.fallback.internalOnly, true);
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'memo', type: 'text', x: 200, y: 150, width: 400, height: 280, text: 'ハンコのメモ' } }] });
    await page.locator('[data-id="memo"]').first().click({ position: { x: 100, y: 60 } });
    await page.locator('#stamp-open').click();
    assert.deepEqual(await page.locator('[data-stamp-design]').evaluateAll(buttons => buttons.slice(0, 10).map(b => (b as HTMLElement).dataset.stampDesign)),
      ['done_ja','sealed_ja','rejected_ja','on_hold_ja','handle_with_care_ja','done_en','sealed_en','rejected_en','on_hold_en','handle_with_care_en']);
    for (const id of ['on_hold_ja','on_hold_en','handle_with_care_ja','handle_with_care_en','shirangana_ja','nandeyanen_ja']) {
      await page.locator(`[data-stamp-design="${id}"]`).click();
      assert.equal((await call('desk_get', { id: 'memo' })).stamp.designId, id);
    }
    await mkdir('tmp/stamps', { recursive: true });
    await page.locator('#stamp-palette').screenshot({ path: 'tmp/stamps/palette.png' });
    const praise = page.locator('[data-stamp-design="well_done_ja"] svg');
    assert.ok((await praise.textContent())?.includes('たいへんよくできました'));
    assert.equal(await praise.locator('path').count(), 1); // Cherry-blossom border accompanies the large lettering.
    await page.locator('#stamp-dated').check();
    await page.locator('[data-stamp-design="done_ja"]').click();
    const stamp = (await call('desk_get', { id: 'memo' })).stamp;
    assert.match(stamp.text, /^\d{4}\.\d{2}\.\d{2}$/); assert.ok(stamp.angle <= -3 && stamp.angle >= -9);
    const ink = page.locator('[data-id="memo"] [data-stamp]');
    await page.waitForFunction(() => document.querySelector('[data-id="memo"] [data-stamp]')?.getAttribute('data-compact') === 'true');
    await page.locator('#stamp-open').click();
    await page.mouse.click(850, 700);
    await page.waitForFunction(() => document.querySelector('[data-id="memo"] [data-stamp]')?.getAttribute('data-compact') === 'false');
    const normal = await ink.getAttribute('transform');
    await call('desk_point', { ids: ['memo'] }); assert.equal(await ink.getAttribute('data-compact'), 'false');
    await call('desk_execute', { operations: [{ kind: 'update', id: 'memo', patch: { width: 700, height: 500 } }] });
    assert.notEqual(await ink.getAttribute('transform'), normal);
    await call('desk_execute', { operations: [{ kind: 'update', id: 'memo', patch: { stamp: { designId: 'future-id', text: '<script>へんてこ</script>', angle: -8 } } }] });
    assert.ok((await ink.textContent())?.includes('<script>へんてこ</script>')); assert.equal(await ink.locator('script').count(), 0);
    await page.locator('[data-id="memo"]').first().click({ position: { x: 100, y: 60 } });
    await page.locator('#stamp-open').click(); await page.locator('#stamp-clear').click();
    assert.equal((await call('desk_get', { id: 'memo' })).stamp, null);
    await call('desk_undo'); assert.equal((await call('desk_get', { id: 'memo' })).stamp.designId, 'future-id');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
