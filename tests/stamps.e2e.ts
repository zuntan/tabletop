import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDesk } from './desk-browser';

test('stamp palette, arbitrary fallback text, selection retreat, resize and shared Undo', { timeout: 60_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('stamps');
  try {
    const patterns = await call('desk_stamp_patterns');
    assert.equal(patterns.patterns.length, 9); assert.equal(patterns.fallback.internalOnly, true);
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'memo', type: 'text', x: 200, y: 150, width: 400, height: 280, text: 'ハンコのメモ' } }] });
    await page.locator('[data-id="memo"]').first().click({ position: { x: 100, y: 60 } });
    await page.locator('#stamp-open').click();
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
