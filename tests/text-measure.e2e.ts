import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';

test('live text measurement is read-only, padding-aware and zoom independent; plain text reports both axes', { timeout: 30_000 }, async () => {
  const { page, call, close, client, errors } = await openTestDesk('text-measure');
  try {
    await call('desk_execute', { operations: [
      { kind: 'add', object: { id: 'md', type: 'text', width: 240, height: 50, padding: 24, cornerRadius: 20, text: '### 見出し\n\n- 文章の長さと折り返しを測ります。\n- 二つめの行も測ります。' } },
      { kind: 'add', object: { id: 'plain', type: 'roundedRect', x: 300, width: 50, height: 20, text: 'a very long line\n二行目\n三行目', fontSize: 24 } },
      { kind: 'add', object: { id: 'empty', type: 'rect', width: 100, height: 100 } },
      { kind: 'add', object: { id: 'other', type: 'ellipse' } },
    ] });
    await call('desk_select', { ids: ['md'] }); await call('desk_point', { ids: ['plain'] });
    const before = await call('desk_state');
    const report = await call('desk_text_measure', { ids: ['md', 'plain', 'empty', 'other'] });
    assert.equal(report.revision, before.revision); assert.equal(report.sessionId, before.sessionId);
    assert.equal(report.coordinateSpace, 'world');
    const [md, plain, empty, other] = report.measurements;
    assert.equal(md.status, 'measured'); assert.equal(md.overflow.y, true); assert.equal(md.overflow.x, false);
    assert.ok(md.requiredHeight > 100); assert.equal(md.canFitByHeight, true);
    assert.equal(plain.overflow.x, true); assert.equal(plain.overflow.y, true); assert.equal(plain.canFitByHeight, false);
    assert.deepEqual(empty.overflow, { x: false, y: false }); assert.equal(empty.requiredHeight, 0);
    assert.equal(other.status, 'unsupported');
    for (const zoom of [0.25, 2]) {
      await call('desk_camera_move', { zoom, durationMs: 0 });
      assert.deepEqual((await call('desk_text_measure', { ids: ['md', 'plain', 'empty', 'other'] })).measurements, report.measurements);
    }
    assert.deepEqual(await call('desk_state'), before);
    await call('desk_execute', { operations: [{ kind: 'update', id: 'md', patch: { height: md.requiredHeight } }] });
    assert.equal((await call('desk_text_measure', { ids: ['md'] })).measurements[0].overflow.y, false);
    await call('desk_undo'); assert.deepEqual((await call('desk_get', { id: 'md' })).height, 50);
    await page.locator('#thinking-mode').click();
    assert.equal((await call('desk_text_measure', { ids: ['md'] })).measurements[0].status, 'measured');
    assert.equal(await page.locator('#text-measure').isVisible(), false);
    assert.equal(await page.locator('#text-measure-result').isVisible(), false);
    const bad = await client.callTool({ name: 'desk_text_measure', arguments: { ids: ['missing'] } });
    assert.equal(bad.isError, true);
    const view = await page.locator('[data-id="md"]').evaluate(g => ({
      rx: g.querySelector('rect')!.getAttribute('rx'), padding: getComputedStyle(g.querySelector('.markdown-text')!).padding,
    }));
    assert.equal(view.rx, '20'); assert.equal(view.padding, '24px');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('text card properties, copy, undo and save/load keep padding and corner radius', { timeout: 30_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('text-card');
  try {
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'card', type: 'text', x: 100, y: 100, width: 500, height: 300, fillOpacity: 1, fill: '#fff7ed', text: '# 一枚のカード\n\n本文です。' } }] });
    await call('desk_select', { ids: ['card'] });
    await page.locator('#properties [name="padding"]').fill('24');
    await page.locator('#properties [name="cornerRadius"]').fill('18');
    await page.locator('#properties button[type="submit"]').click();
    let card = await call('desk_get', { id: 'card' }); assert.equal(card.padding, 24); assert.equal(card.cornerRadius, 18);
    await call('desk_undo'); card = await call('desk_get', { id: 'card' }); assert.equal(card.padding, undefined); assert.equal(card.cornerRadius, 16);
    await call('desk_redo');
    await page.locator('#canvas').focus(); await page.keyboard.press('Control+c'); await page.keyboard.press('Control+v');
    await page.waitForFunction(() => document.querySelectorAll('#objects > [data-id]').length === 2);
    const state = await call('desk_state'); assert.equal(state.objects[1].padding, 24); assert.equal(state.objects[1].cornerRadius, 18);
    const saved = await call('desk_save', { filename: `text-card-${Date.now()}.tabletop` });
    await call('desk_execute', { operations: [{ kind: 'update', id: 'card', patch: { padding: 0, cornerRadius: 0 } }] });
    const now = await call('desk_summary');
    await call('desk_load', { filename: saved.filename, confirm: true, expectedSessionId: now.sessionId, expectedRevision: now.revision });
    card = await call('desk_get', { id: 'card' }); assert.equal(card.padding, 24); assert.equal(card.cornerRadius, 18);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
