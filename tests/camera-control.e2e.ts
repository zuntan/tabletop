import {callTestTool} from './mcp-call';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';

const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.001, `${actual} vs ${expected}`);

test('AI camera controls use the live view, preserve both selections and never change the document', { timeout: 35_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('camera-controls');
  try {
    await call('desk_execute', { operations: [
      { kind: 'add', object: { id: 'human', type: 'rect', x: -500, y: -300 } },
      { kind: 'add', object: { id: 'ai', type: 'text', x: 1000, y: 500, text: 'Memo' } },
    ] });
    await call('desk_select', { ids: ['human'] }); await call('desk_point', { ids: ['ai'] });
    const before = await call('desk_state');
    async function checkDOM() {
      const view = await call('desk_camera_get');
      const actual = await page.locator('#viewport').evaluate(el => {
        const matrix = (el as unknown as SVGGElement).transform.baseVal.consolidate()!.matrix;
        const canvas = document.querySelector('#canvas')!;
        return { x: matrix.e, y: matrix.f, zoom: matrix.a, width: canvas.clientWidth, height: canvas.clientHeight };
      });
      near(view.zoom, actual.zoom);
      near(view.center.x, (actual.width / 2 - actual.x) / actual.zoom);
      near(view.center.y, (actual.height / 2 - actual.y) / actual.zoom);
      near(view.visibleBounds.x, -actual.x / actual.zoom);
      near(view.visibleBounds.y, -actual.y / actual.zoom);
      near(view.visibleBounds.width, actual.width / actual.zoom);
      assert.deepEqual(view.viewport, { width: actual.width, height: actual.height });
      return view;
    }
    await checkDOM();
    let result = await call('desk_camera_move', { center: { x: -200, y: 300 }, zoom: 1.5 });
    assert.deepEqual(result.center, { x: -200, y: 300 }); near(result.zoom, 1.5);
    assert.equal(result.zoomClamped, false); await checkDOM();
    result = await call('desk_camera_move', { zoomBy: 1.25 });
    assert.deepEqual(result.center, { x: -200, y: 300 }); near(result.zoom, 1.875);
    result = await call('desk_camera_move', { pan: { x: 80, y: -20 } });
    near(result.center.x, -120); near(result.center.y, 280); near(result.zoom, 1.875);
    result = await call('desk_camera_move', { pan: { x: -20, y: 50 }, zoomBy: 0.8 });
    near(result.center.x, -140); near(result.center.y, 330); near(result.zoom, 1.5);
    result = await call('desk_camera_move', { zoomBy: 100 });
    assert.equal(result.zoom, 8); assert.equal(result.zoomClamped, true);
    result = await call('desk_camera_move', { zoomBy: 0.01 });
    result = await call('desk_camera_move', { zoomBy: 0.01 });
    assert.equal(result.zoom, 0.05); assert.equal(result.zoomClamped, true);
    await call('desk_camera_move', { zoom: 1, center: { x: 0, y: 0 } });
    const centered = await checkDOM();
    await page.locator('#zoom-in').click();
    result = await checkDOM(); near(result.zoom, 1.25);
    near(result.center.x, centered.center.x); near(result.center.y, centered.center.y);
    // Human pan and viewport changes must be reflected by the read tool, not stale cached values.
    const canvas = (await page.locator('#canvas').boundingBox())!;
    await page.mouse.move(canvas.x + 100, canvas.y + 100); await page.mouse.down({ button: 'middle' });
    await page.mouse.move(canvas.x + 140, canvas.y + 120); await page.mouse.up({ button: 'middle' });
    result = await checkDOM(); near(result.center.x, -40 / 1.25); near(result.center.y, -20 / 1.25);
    await page.locator('#sidebar-toggle').click(); await checkDOM();
    await page.setViewportSize({ width: 1600, height: 1000 }); await checkDOM();
    assert.deepEqual(await call('desk_state'), before);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('camera writes reject invalid combinations, human editing and gestures without stealing focus', { timeout: 35_000 }, async () => {
  const { page, call, client, close, errors } = await openTestDesk('camera-guards');
  try {
    const before = await call('desk_camera_get');
    for (const args of [{}, { zoom: 0 }, { zoom: 9 }, { zoomBy: 0 }, { zoom: 2, zoomBy: 2 }, { center: { x: 0, y: 0 }, pan: { x: 1, y: 1 } }]) {
      const result = await callTestTool(client, { name: 'desk_camera_move', arguments: args });
      assert.equal(result.isError, true, JSON.stringify(args));
      assert.deepEqual(await call('desk_camera_get'), before);
    }
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'memo', type: 'text', x: 100, y: 100, text: 'Human memo' } }] });
    await page.locator('[data-id="memo"] .markdown-text').dblclick();
    const input = page.locator('[data-inline-text]'); await input.fill('Still editing');
    const denied = await callTestTool(client, { name: 'desk_camera_move', arguments: { zoomBy: 1.25 } });
    assert.equal(denied.isError, true); assert.match(JSON.stringify(denied), /Human editing in progress/);
    assert.deepEqual(await call('desk_camera_get'), before);
    assert.equal(await input.inputValue(), 'Still editing'); assert.equal(await input.evaluate(el => el === document.activeElement), true);
    await input.press('Escape');
    const canvas = (await page.locator('#canvas').boundingBox())!;
    await page.mouse.move(canvas.x + 50, canvas.y + 50); await page.mouse.down({ button: 'middle' });
    try {
      const denied = await callTestTool(client, { name: 'desk_camera_move', arguments: { pan: { x: 100, y: 0 } } });
      assert.equal(denied.isError, true); assert.match(JSON.stringify(denied), /Human editing in progress/);
      assert.deepEqual(await call('desk_camera_get'), before);
    } finally { await page.mouse.up({ button: 'middle' }); }
    await page.locator('#thinking-mode').click();
    const alone = await callTestTool(client, { name: 'desk_camera_move', arguments: { zoom: 2 } });
    assert.equal(alone.isError, true); assert.match(JSON.stringify(alone), /ひとりで考えています/);
    assert.deepEqual(await call('desk_camera_get'), before);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
