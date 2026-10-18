import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';

const closeTo = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.02, `${actual} vs ${expected}`);

test('pins and descriptions keep screen size, connector anchors and selection follow, threads update live', { timeout: 30_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('pin-fixed-size');
  try {
    await call('desk_execute', { operations: [
      { kind: 'series_update', id: 'series-1', patch: { thread: { enabled: true, visible: true } } },
      { kind: 'label_add', id: 'p1', seriesId: 'series-1', x: 300, y: 250, description: '説明文' },
      { kind: 'label_add', id: 'p2', seriesId: 'series-1', x: 500, y: 350 },
      { kind: 'update', id: 'p1', patch: { locked: true } },
      { kind: 'add', object: { id: 'edge', type: 'arrow', x: 50, y: 150, endBinding: { objectId: 'p1', anchor: 'right' } } },
    ] });
    await call('desk_select', { ids: ['p1'] }); await call('desk_point', { ids: ['p1'] });
    const before = await call('desk_state');
    const sizes: { width: number; height: number; description: number }[] = [];
    for (const zoom of [1, 0.5, 2]) {
      await call('desk_camera_move', { center: { x: 350, y: 300 }, zoom, durationMs: 0 });
      const metrics = await page.evaluate(() => {
        const pin = document.querySelector('[data-id="p1"]') as unknown as SVGGElement;
        const shape = pin.querySelector('.pin-frame')!.getBoundingClientRect();
        const description = pin.querySelector('[data-label-description]')!.getBoundingClientRect();
        const frame = document.querySelector('[data-ai-point="p1"]')!.getBoundingClientRect();
        const line = document.querySelector('[data-id="edge"] .connector-line') as SVGLineElement;
        const endpoint = new DOMPoint(line.x2.baseVal.value, line.y2.baseVal.value).matrixTransform(line.getScreenCTM()!);
        return { width: shape.width, height: shape.height, description: description.width, frame: frame.width,
          right: shape.right, centerY: shape.top + shape.height / 2, endX: endpoint.x, endY: endpoint.y,
          lock: document.querySelector('[data-lock-badge="p1"]')!.getBoundingClientRect().width };
      });
      sizes.push(metrics);
      closeTo(metrics.width, 36); closeTo(metrics.height, 48);
      closeTo(metrics.endX, metrics.right); closeTo(metrics.endY, metrics.centerY);
      closeTo(metrics.lock, 22); assert.ok(metrics.frame > metrics.width);
    }
    closeTo(sizes[0].description, sizes[1].description); closeTo(sizes[1].description, sizes[2].description);
    assert.deepEqual(await call('desk_state'), before);
    const thread = page.locator('[data-pin-thread="series-1"]');
    assert.equal(await thread.getAttribute('points'), '318,298 518,398');
    await call('desk_execute', { operations: [{ kind: 'update', id: 'p2', patch: { x: 600, y: 400 } }] });
    assert.equal(await thread.getAttribute('points'), '318,298 618,448');
    await call('desk_undo'); assert.equal(await thread.getAttribute('points'), '318,298 518,398');
    const hit = (await page.locator('[data-id="p2"] .pin-frame').boundingBox())!;
    await page.mouse.move(hit.x + hit.width / 2, hit.y + hit.height / 3);
    await page.mouse.down();
    await page.mouse.move(hit.x + hit.width / 2 + 48, hit.y + hit.height / 3 + 24, { steps: 4 });
    const preview = await thread.getAttribute('points');
    assert.notEqual(preview, '318,298 518,398', 'thread must follow the drag before committing');
    await page.mouse.up();
    assert.equal(await thread.getAttribute('points'), preview);
    await call('desk_undo'); assert.equal(await thread.getAttribute('points'), '318,298 518,398');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('global and series visibility compose in all nine combinations; thread properties and layer ordering work', { timeout: 30_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('pin-series-modes');
  try {
    await call('desk_execute', { operations: [
      { kind: 'series_update', id: 'series-1', patch: { thread: { enabled: true, visible: true } } },
      { kind: 'label_add', id: 'a', seriesId: 'series-1', x: 200, y: 200, description: 'A' },
      { kind: 'add', object: { id: 'card', type: 'rect', x: 600, y: 400 } },
      { kind: 'label_add', id: 'b', seriesId: 'series-1', x: 400, y: 200, description: 'B' },
    ] });
    const modes = ['all', 'pins', 'hidden'] as const;
    const captions = ['ピンとテキスト', 'ピンのみ', 'ピン非表示'];
    for (let global = 0; global < 3; global++) {
      assert.equal(await page.locator('#label-descriptions .tool-caption').textContent(), captions[global]);
      for (let series = 0; series < 3; series++) {
        await call('desk_execute', { operations: [{ kind: 'series_update', id: 'series-1', patch: { visibility: modes[series] } }] });
        const effective = Math.max(global, series);
        assert.equal(await page.locator('[data-id="a"], [data-id="b"]').count(), effective === 2 ? 0 : 2);
        assert.equal(await page.locator('[data-label-description]').count(), effective === 0 ? 2 : 0);
        assert.equal(await page.locator('[data-pin-thread]').count(), effective === 2 ? 0 : 1);
      }
      await page.locator('#label-descriptions').click();
    }
    await call('desk_execute', { operations: [{ kind: 'series_update', id: 'series-1', patch: { visibility: 'all' } }] });
    await call('desk_select', { ids: ['a'] });
    assert.equal(await page.locator('#series-panel h2').textContent(), 'ピンシリーズ');
    await page.locator('[data-color-role="thread-stroke"]').click();
    await page.locator('.palette-thread-stroke button[aria-label="色 #ef4444"]').click();
    await page.locator('[name="thread.width"]').fill('4');
    await page.locator('[name="thread.width"]').dispatchEvent('change');
    await page.locator('[name="thread.dash"]').selectOption('dashed');
    const thread = page.locator('[data-pin-thread]');
    assert.equal(await thread.getAttribute('stroke'), '#ef4444'); assert.equal(await thread.getAttribute('stroke-width'), '4');
    assert.equal(await thread.getAttribute('stroke-dasharray'), '16 12');
    await page.getByRole('switch', { name: '糸を表示' }).click(); assert.equal(await thread.count(), 0);
    await page.getByRole('switch', { name: '糸を表示' }).click(); assert.equal(await thread.count(), 1);
    await page.locator('#front').click();
    assert.deepEqual((await call('desk_list')).objects.map((o: { id: string }) => o.id), ['card', 'a', 'b']);
    assert.deepEqual(await page.locator('#objects').evaluate(el => [...el.children].map(node => node.getAttribute('data-id') ?? `thread:${node.getAttribute('data-pin-thread')}`)), ['card', 'thread:series-1', 'a', 'b']);
    await page.locator('#tab-objects').click();
    assert.equal(await page.locator('#object-list .object-row').count(), 3);
    await page.locator('#back').click();
    assert.deepEqual((await call('desk_list')).objects.map((o: { id: string }) => o.id), ['a', 'b', 'card']);
    await call('desk_undo');
    assert.deepEqual((await call('desk_list')).objects.map((o: { id: string }) => o.id), ['card', 'a', 'b']);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
