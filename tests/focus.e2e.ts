import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';
import { fittedCamera } from '../src/focus-camera';

test('human and AI fit their own targets while camera actions preserve the document and selections', { timeout: 35_000 }, async () => {
  const { page, call, client, close, errors } = await openTestDesk('focus-camera');
  const camera = () => page.locator('#viewport').evaluate(el => {
    const matrix = (el as unknown as SVGGElement).transform.baseVal.consolidate()!.matrix;
    return { x: matrix.e, y: matrix.f, zoom: matrix.a };
  });
  try {
    await call('desk_fit'); // Empty desk is a safe no-op.
    await call('desk_execute', { operations: [
      { kind: 'add', object: { id: 'human', type: 'rect', x: -500, y: -300, width: 400, height: 300 } },
      { kind: 'add', object: { id: 'ai', type: 'rect', x: 3000, y: 2000, width: 600, height: 400 } },
      { kind: 'add', object: { id: 'memo', type: 'text', x: 2000, y: -900, width: 300, height: 200, text: 'Memo' } },
    ] });
    await call('desk_select', { ids: ['human'] });
    await call('desk_point', { ids: ['ai'] });
    const before = await call('desk_state');
    const size = await page.locator('#canvas').evaluate(el => ({ width: el.clientWidth, height: el.clientHeight }));
    async function check(ids: string[]) {
      const actual = await camera();
      const expected = fittedCamera(ids.length ? before.objects.filter((object: { id: string }) => ids.includes(object.id)) : before.objects, size.width, size.height)!;
      for (const key of ['x', 'y', 'zoom'] as const) assert.ok(Math.abs(actual[key] - expected[key]) < 0.001, `${key}: ${actual[key]} vs ${expected[key]}`);
    }
    assert.equal(await page.locator('#fit').getAttribute('aria-label'), '選択範囲を表示');
    await page.locator('#fit').click(); await check(['human']);
    assert.deepEqual(await call('desk_state'), before);
    const aiFit = await call('desk_fit'); await check(['ai']);
    assert.deepEqual(aiFit.ids, ['ai']); assert.equal(aiFit.scope, 'selection');
    assert.deepEqual(await call('desk_state'), before);
    await call('desk_point', { ids: [] });
    assert.equal((await call('desk_fit')).scope, 'all'); await check([]);
    await call('desk_select', { ids: ['human', 'memo'] });
    await page.locator('#fit').click(); await check(['human', 'memo']);
    await call('desk_select', { ids: [] });
    await call('desk_point', { ids: ['ai'] });
    assert.equal(await page.locator('#fit .tool-caption').textContent(), '全体');
    await page.locator('#fit').click(); await check([]); // Ignore the AI target for human actions.
    const after = await call('desk_state');
    assert.deepEqual(after.objects, before.objects);
    assert.deepEqual(after.settings, before.settings);
    assert.equal(after.revision, before.revision);
    // AI camera changes refuse active human editing and must not steal input.
    await call('desk_select', { ids: ['memo'] }); await page.locator('#fit').click();
    await page.locator('[data-id="memo"] .markdown-text').dblclick();
    const input = page.locator('[data-inline-text]'); await input.fill('Unsaved human edit');
    const editingCamera = await camera();
    const rejected = await client.callTool({ name: 'desk_fit', arguments: {} });
    assert.equal(rejected.isError, true);
    assert.match(JSON.stringify(rejected), /Human editing in progress/);
    assert.deepEqual(await camera(), editingCamera);
    assert.equal(await input.inputValue(), 'Unsaved human edit');
    await input.press('Escape');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('floating view controls anchor to the whole work area without lifting the canvas hint', { timeout: 30_000 }, async () => {
  const { page, close, errors } = await openTestDesk('floating-view');
  try {
    assert.equal(await page.locator('nav .toolbar-view').count(), 0);
    assert.equal(await page.locator('main > .toolbar-view button').count(), 4);
    for (const width of [1920, 1400, 850, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const hidden of [false, true]) {
        if (hidden) await page.locator('#sidebar-toggle').click();
        await page.locator('.toolbar-view').scrollIntoViewIfNeeded();
        const area = (await page.locator('main').boundingBox())!;
        const workspace = (await page.locator('#workspace').boundingBox())!;
        const canvas = (await page.locator('#canvas').boundingBox())!;
        const panel = (await page.locator('.toolbar-view').boundingBox())!;
        assert.equal(canvas.height, workspace.height);
        assert.equal(canvas.width, workspace.width);
        assert.equal(Math.round(area.x + area.width - panel.x - panel.width), 12);
        assert.equal(Math.round(area.y + area.height - panel.y - panel.height), 12);
        assert.ok(panel.x >= area.x && panel.y >= area.y);
        const hint = (await page.locator('#workspace > .hint').boundingBox())!;
        assert.equal(Math.round(workspace.y + workspace.height - hint.y - hint.height), 12);
        if (!hidden && width > 580) assert.ok(panel.x >= workspace.x + workspace.width);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        const passesThrough = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.toolbar-view') === null,
          { x: panel.x - 8, y: panel.y + 10 });
        assert.equal(passesThrough, true);
        if (hidden) await page.locator('#sidebar-toggle').click();
      }
    }
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
