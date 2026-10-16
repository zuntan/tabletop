import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';
import { HUMAN_SCROLL_CAMERA_REFUSAL } from '../src/camera-activity';

// Keep receipt-time assertions deterministic even under parallel test load.
const clock = `window.cameraTestNow = 0;
Object.defineProperty(performance, 'now', { value: () => window.cameraTestNow, configurable: true });`;

test('human wheel zoom wins over AI camera writes and fit without blocking human controls or reads', { timeout: 30_000 }, async () => {
  const { page, call, client, close, errors } = await openTestDesk('wheel-priority', clock);
  const time = (value: number) => page.evaluate(value => { (window as unknown as { cameraTestNow: number }).cameraTestNow = value; }, value);
  try {
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'memo', type: 'text', text: 'Human view' } }] });
    await call('desk_point', { ids: ['memo'] });
    await page.waitForTimeout(50); await time(1000);
    const before = await call('desk_camera_get');
    const state = await call('desk_state');
    const box = (await page.locator('#canvas').boundingBox())!;
    await page.mouse.move(box.x + 150, box.y + 150);
    await page.mouse.wheel(0, 120);
    await page.waitForFunction(() => document.querySelector('#zoom-reset .tool-icon')?.textContent !== '100%');
    const humanView = await call('desk_camera_get');
    assert.notEqual(humanView.zoom, before.zoom);
    for (const [name, args] of [
      ['desk_camera_move', { pan: { x: 100, y: 0 }, zoomBy: 1.25 }],
      ['desk_fit', {}],
    ] as const) {
      const result = await client.callTool({ name, arguments: args });
      assert.equal(result.isError, true);
      assert.ok(JSON.stringify(result).includes(HUMAN_SCROLL_CAMERA_REFUSAL));
      assert.deepEqual(await call('desk_camera_get'), humanView);
    }
    // This is a camera-specific refusal, not a freeze of human editing or controls.
    await page.locator('#zoom-in').click();
    const manual = await call('desk_camera_get');
    assert.ok(manual.zoom > humanView.zoom);
    assert.deepEqual(await call('desk_state'), state);
    await time(1399);
    const refused = await client.callTool({ name: 'desk_fit', arguments: {} });
    assert.equal(refused.isError, true);
    await time(2000); await page.waitForTimeout(500);
    assert.deepEqual(await call('desk_camera_get'), manual); // Nothing is replayed when the quiet period ends.
    await call('desk_camera_move', { zoomBy: 1.25 });
    assert.ok((await call('desk_camera_get')).zoom > manual.zoom);
    assert.deepEqual(await call('desk_state'), state);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('native sidebar scrolling also cancels AI camera actions conservatively and extends with new events', { timeout: 30_000 }, async () => {
  const { page, call, client, close, errors } = await openTestDesk('sidebar-scroll-priority', clock);
  const time = (value: number) => page.evaluate(value => { (window as unknown as { cameraTestNow: number }).cameraTestNow = value; }, value);
  try {
    await page.getByRole('tab', { name: '接続', exact: true }).click();
    const panel = page.locator('[role="tabpanel"]:visible');
    // Make the real scroll container small, then scroll it without a wheel event.
    await panel.evaluate(el => { (el as HTMLElement).style.height = '100px'; });
    await time(1000);
    await panel.evaluate(el => { el.scrollTop = 50; });
    await page.waitForTimeout(50);
    assert.ok(await panel.evaluate(el => el.scrollTop) > 0);
    const before = await call('desk_camera_get');
    const denied = await client.callTool({ name: 'desk_camera_move', arguments: { pan: { x: 10, y: 0 } } });
    assert.equal(denied.isError, true);
    assert.ok(JSON.stringify(denied).includes(HUMAN_SCROLL_CAMERA_REFUSAL));
    await time(1350);
    await panel.evaluate(el => { el.scrollTop = 70; });
    await page.waitForTimeout(50);
    await time(1700);
    const stillDenied = await client.callTool({ name: 'desk_fit', arguments: {} });
    assert.equal(stillDenied.isError, true);
    assert.deepEqual(await call('desk_camera_get'), before);
    await time(2000); await page.waitForTimeout(500);
    assert.deepEqual(await call('desk_camera_get'), before);
    await call('desk_camera_move', { pan: { x: 10, y: 0 } });
    assert.equal((await call('desk_camera_get')).center.x, before.center.x + 10);
    await page.setViewportSize({ width: 390, height: 600 });
    await time(3000); await page.evaluate(() => window.scrollTo(0, 150));
    await page.waitForTimeout(50);
    assert.ok(await page.evaluate(() => window.scrollY) > 0);
    const scrolledPage = await call('desk_camera_get');
    const pageDenied = await client.callTool({ name: 'desk_camera_move', arguments: { zoomBy: 2 } });
    assert.equal(pageDenied.isError, true);
    assert.ok(JSON.stringify(pageDenied).includes(HUMAN_SCROLL_CAMERA_REFUSAL));
    assert.deepEqual(await call('desk_camera_get'), scrolledPage);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
