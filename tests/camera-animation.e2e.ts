import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';

async function matrix(page: import('playwright').Page) {
  return page.locator('#viewport').evaluate(el => {
    const m = (el as unknown as SVGGElement).transform.baseVal.consolidate()!.matrix;
    return { x: m.e, y: m.f, zoom: m.a };
  });
}

test('one AI command animates multiple frames, read remains live and fit also flies', { timeout: 30_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('camera-flight');
  try {
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'far', type: 'rect', x: 10000, y: 5000 } }] });
    await call('desk_point', { ids: ['far'] });
    const state = await call('desk_state');
    const before = await call('desk_camera_get');
    const move = call('desk_camera_move', { center: { x: -5000, y: 2000 }, zoom: 2, durationMs: 1200 });
    await page.waitForFunction(() => {
      const m = (document.querySelector('#viewport') as unknown as SVGGElement).transform.baseVal.consolidate()!.matrix;
      return m.a !== 1;
    });
    const middle = await call('desk_camera_get');
    assert.notDeepEqual(middle, before); assert.notEqual(middle.center.x, -5000);
    const end = await move;
    assert.equal(end.zoom, 2); assert.equal(end.center.x, -5000);
    const fit = call('desk_fit', { durationMs: 1000 });
    await page.waitForFunction(() => (document.querySelector('#viewport') as unknown as SVGGElement).transform.baseVal.consolidate()!.matrix.a !== 2);
    const fitting = await call('desk_camera_get');
    assert.notEqual(fitting.center.x, 10090);
    const fitted = await fit;
    assert.deepEqual(fitted.ids, ['far']); assert.equal(fitted.scope, 'selection');
    assert.ok((await call('desk_camera_get')).center.x > 10000);
    assert.deepEqual(await call('desk_state'), state); assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('human input interrupts at the current frame and never resumes; resize and thinking mode cancel too', { timeout: 30_000 }, async () => {
  const { page, call, client, close, errors } = await openTestDesk('camera-flight-cancel');
  try {
    const box = (await page.locator('#canvas').boundingBox())!;
    await page.mouse.move(box.x + 150, box.y + 150);
    for (const interrupt of ['wheel', 'pointer', 'resize', 'thinking'] as const) {
      await page.waitForTimeout(450);
      const before = await matrix(page);
      const pending = client.callTool({ name: 'desk_camera_move', arguments: { pan: { x: 8000, y: 3000 }, zoomBy: 1.5, durationMs: 1800 } });
      await page.waitForFunction(before => {
        const m = (document.querySelector('#viewport') as unknown as SVGGElement).transform.baseVal.consolidate()!.matrix;
        return Math.abs(m.e - before.x) > 5;
      }, before);
      if (interrupt === 'wheel') await page.mouse.wheel(0, 100);
      if (interrupt === 'pointer') { await page.mouse.down({ button: 'middle' }); await page.mouse.up({ button: 'middle' }); }
      if (interrupt === 'resize') await page.setViewportSize({ width: 1500, height: 950 });
      if (interrupt === 'thinking') await page.locator('#thinking-mode').click();
      const result = await pending;
      assert.equal(result.isError, true, interrupt);
      assert.match(JSON.stringify(result), /Camera animation cancelled.*do not retry automatically/);
      await page.waitForTimeout(100);
      const stopped = await matrix(page);
      await page.waitForTimeout(250);
      assert.deepEqual(await matrix(page), stopped, interrupt);
      if (interrupt === 'thinking') await page.locator('#thinking-mode').click();
    }
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('instant override and reduced motion land immediately; duration-only requests are rejected', { timeout: 20_000 }, async () => {
  const { page, call, client, close, errors } = await openTestDesk('camera-flight-reduced');
  try {
    const instant = await call('desk_camera_move', { center: { x: 100, y: 200 }, durationMs: 0 });
    assert.deepEqual(instant.center, { x: 100, y: 200 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reduced = await call('desk_camera_move', { center: { x: -1000, y: 500 }, zoom: 2, durationMs: 2000 });
    assert.deepEqual(reduced.center, { x: -1000, y: 500 }); assert.equal(reduced.zoom, 2);
    const invalid = await client.callTool({ name: 'desk_camera_move', arguments: { durationMs: 100 } });
    assert.equal(invalid.isError, true);
    const { zoomClamped: _clamped, ...view } = reduced;
    assert.deepEqual(await call('desk_camera_get'), view);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
