import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Page } from 'playwright';
import { openTestDesk } from './desk-browser';

async function screen(page: Page, x: number, y: number) {
  return page.locator('#viewport').evaluate((el, point) => {
    const p = new DOMPoint(point.x, point.y).matrixTransform((el as unknown as SVGGElement).getScreenCTM()!);
    return { x: p.x, y: p.y };
  }, { x, y });
}
async function drag(page: Page, x: number, y: number, dx: number, dy: number) {
  const start = await screen(page, x, y), end = await screen(page, x + dx, y + dy);
  await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 5 }); await page.mouse.up();
}

test('mouse lock controls, bottom-right badge and mixed selection protect geometry but allow explicit editing', { timeout: 30_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('object-mouse-lock');
  try {
    assert.equal(await page.locator('#mouse-lock').isDisabled(), true);
    assert.equal(await page.locator('#property-lock').isVisible(), true);
    assert.equal(await page.locator('#property-lock').isDisabled(), true);
    assert.equal(await page.locator('#grid-snap').evaluate(el => el.nextElementSibling!.id), 'mouse-lock');
    await call('desk_execute', { operations: [
      { kind: 'add', object: { id: 'a', type: 'rect', x: 100, y: 100, width: 180, height: 100, text: 'Locked' } },
      { kind: 'add', object: { id: 'b', type: 'rect', x: 400, y: 100, width: 120, height: 100 } },
    ] });
    await call('desk_select', { ids: ['a'] });
    assert.equal(await page.locator('#property-lock').isVisible(), true);
    assert.equal(await page.locator('#mouse-lock').isEnabled(), true);
    await page.locator('#mouse-lock').focus(); await page.locator('#mouse-lock').press('Space');
    assert.equal((await call('desk_get', { id: 'a' })).locked, true);
    assert.equal(await page.locator('#property-lock').getAttribute('role'), 'switch');
    assert.equal(await page.locator('#property-lock').getAttribute('aria-checked'), 'true');
    assert.equal(await page.locator('[data-resize="a"]').count(), 0);
    const badge = page.locator('[data-lock-badge="a"]');
    assert.equal(await badge.getAttribute('pointer-events'), 'none');
    assert.match((await badge.getAttribute('transform'))!, /^translate\(280 200\)/);
    assert.equal(await page.locator('#objects [data-id="a"]').evaluate(el => getComputedStyle(el).cursor), 'default');
    const before = await call('desk_get', { id: 'a' });
    const revision = (await call('desk_summary')).revision;
    await drag(page, 150, 150, 60, 40);
    assert.deepEqual(await call('desk_get', { id: 'a' }), before);
    assert.equal((await call('desk_summary')).revision, revision);
    // Dragging the former resize corner hits the locked object, not an active handle.
    await drag(page, 279, 199, 60, 40);
    assert.deepEqual(await call('desk_get', { id: 'a' }), before);

    await call('desk_select', { ids: ['a', 'b'] });
    assert.equal(await page.locator('#mouse-lock').getAttribute('aria-pressed'), 'mixed');
    assert.equal(await page.locator('#property-lock').isVisible(), false);
    assert.equal(await page.locator('#property-lock-mixed').isVisible(), true);
    assert.equal(await page.locator('#property-lock-mixed').textContent(), '→ ON');
    await drag(page, 450, 150, 48, 24);
    assert.deepEqual(await call('desk_get', { id: 'a' }), before);
    assert.equal((await call('desk_get', { id: 'b' })).x, 456); // Destination follows the shared 24-unit grid.
    await page.locator('#property-lock-mixed').click();
    assert.equal((await call('desk_get', { id: 'a' })).locked, true);
    assert.equal((await call('desk_get', { id: 'b' })).locked, true);
    assert.equal(await page.locator('#mouse-lock').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#property-lock').isVisible(), true);
    assert.equal(await page.locator('#property-lock').getAttribute('aria-checked'), 'true');
    assert.equal(await page.locator('#property-lock-mixed').isVisible(), false);
    await page.locator('#undo').click();
    assert.equal((await call('desk_get', { id: 'a' })).locked, true);
    assert.equal(!!(await call('desk_get', { id: 'b' })).locked, false);
    await call('desk_select', { ids: ['a'] });
    const p = await screen(page, 150, 150); await page.mouse.dblclick(p.x, p.y);
    const editor = page.locator('[data-inline-text]'); await editor.waitFor();
    await editor.fill('Double-click allowed'); await editor.press('Enter');
    assert.equal((await call('desk_get', { id: 'a' })).text, 'Double-click allowed');
    assert.equal((await call('desk_get', { id: 'a' })).locked, true);
    await page.locator('#properties [name="x"]').fill('125');
    await page.locator('#properties [type="submit"]').click();
    assert.equal((await call('desk_get', { id: 'a' })).x, 125);
    await page.locator('#property-lock').click();
    assert.equal((await call('desk_get', { id: 'a' })).locked, false);
    assert.equal(await page.locator('[data-resize="a"]').count(), 1);
    assert.equal(await page.locator('[data-lock-badge="a"]').count(), 0);
    // Keyboard deletion remains deliberate and is not prohibited by the pointer lock.
    await page.locator('#mouse-lock').click(); await page.locator('#canvas').focus(); await page.keyboard.press('Delete');
    assert.equal((await call('desk_summary')).count, 1);
    await page.locator('#undo').click(); assert.equal((await call('desk_get', { id: 'a' })).locked, true);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('AI pointer-set locking is atomic and independent, locks pins/connectors and preserves AI editing and focus', { timeout: 30_000 }, async () => {
  const { page, call, client, close, errors } = await openTestDesk('object-ai-lock');
  try {
    await call('desk_execute', { operations: [
      { kind: 'add', object: { id: 'a', type: 'rect', x: 100, y: 100 } },
      { kind: 'add', object: { id: 'line', type: 'arrow', x: 500, y: 300, x2: 300, y2: 200 } },
      { kind: 'series_add', series: { id: 's', name: 'Pins' } },
      { kind: 'label_add', id: 'pin', seriesId: 's', x: 600, y: 100 },
    ] });
    await call('desk_select', { ids: ['a'] });
    const empty = await client.callTool({ name: 'desk_lock', arguments: { locked: true } }); assert.equal(empty.isError, true);
    await call('desk_point', { ids: ['line', 'pin'] });
    const revision = (await call('desk_summary')).revision;
    const result = await call('desk_lock', { locked: true, expectedRevision: revision });
    assert.equal(result.revision, revision + 1); assert.deepEqual(result.ids, ['line', 'pin']);
    assert.equal(!!(await call('desk_get', { id: 'a' })).locked, false);
    assert.deepEqual((await call('desk_selection')).ids, ['a']);
    await call('desk_select', { ids: ['line'] });
    assert.equal(await page.locator('[data-endpoint]').count(), 0);
    assert.equal(await page.locator('[data-locked-selection="line"]').count(), 1);
    assert.equal(await page.locator('[data-ai-point]').count() > 0, true);
    const line = await call('desk_get', { id: 'line' });
    await drag(page, 400, 250, 24, 24); assert.deepEqual(await call('desk_get', { id: 'line' }), line);
    await call('desk_execute', { operations: [{ kind: 'update', id: 'line', patch: { x: 550, x2: 350 } }] });
    assert.equal((await call('desk_get', { id: 'line' })).x, 550);
    await call('desk_fit', { durationMs: 0 });
    const stale = await client.callTool({ name: 'desk_lock', arguments: { locked: false, expectedRevision: revision } }); assert.equal(stale.isError, true);
    await page.locator('#thinking-mode').click();
    const denied = await client.callTool({ name: 'desk_lock', arguments: { locked: false } }); assert.equal(denied.isError, true);
    assert.equal((await call('desk_get', { id: 'line' })).locked, true);
    await page.locator('#thinking-mode').click();
    await call('desk_point', { ids: ['line', 'pin'] });
    await call('desk_lock', { locked: false });
    assert.equal(await page.locator('[data-endpoint]').count(), 2);
    assert.equal((await call('desk_get', { id: 'pin' })).locked, false);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
