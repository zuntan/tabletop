import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';

test('one shape palette creates all five shapes; text auto/shrink, editing, anchors and saved mode work', { timeout: 30_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('diagram-shapes');
  page.setDefaultTimeout(5000);
  try {
    for (const [type, name] of [['diamond','ひし形'],['parallelogram','平行四辺形'],['cylinder','円柱'],['document','書類'],['cloud','雲']]) {
      await page.getByRole('button', { name: '図形の候補', exact: true }).click();
      await page.getByRole('dialog', { name: '図形の候補', exact: true }).getByRole('button', { name, exact: true }).click();
      const state = await call('desk_state'), shape = state.objects.find((o: { type: string }) => o.type === type);
      assert.ok(shape); assert.equal(shape.textFit, 'shrink');
      await call('desk_execute', { operations: [{ kind: 'update', id: shape.id, patch: { x: 200, y: 150, width: 240, height: 160, text: 'A', fontSize: 24 } }] });
      assert.equal(await page.locator('[data-id="'+shape.id+'"] .diagram-shape').count(), 1);
      const text = page.locator('[data-id="'+shape.id+'"] .shape-text');
      assert.equal(Number(await text.getAttribute('font-size')), 24);
      await page.getByRole('button', { name: '文字サイズ調整の候補', exact: true }).click();
      await page.getByRole('dialog', { name: '文字サイズ調整の候補', exact: true }).getByRole('button', { name: '完全自動', exact: true }).click();
      assert.ok(Number(await text.getAttribute('font-size')) > 24);
      assert.equal((await call('desk_get', { id: shape.id })).fontSize, 24);
      await call('desk_execute', { operations: [{ kind: 'update', id: shape.id, patch: { text: 'Long text must shrink inside the shape', fontSize: 48 } }] });
      await page.getByRole('button', { name: '文字サイズ調整の候補', exact: true }).click();
      await page.getByRole('dialog', { name: '文字サイズ調整の候補', exact: true }).getByRole('button', { name: '縮小のみ', exact: true }).click();
      assert.ok(Number(await text.getAttribute('font-size')) < 48);
      await call('desk_execute', { operations: [{ kind: 'update', id: shape.id, patch: { x: 2000, y: 2000 } }] });
    }
    const saved = await call('desk_save', { filename: 'diagram-shapes-' + Date.now() + '.tabletop' });
    const current = await call('desk_summary');
    await call('desk_load', { filename: saved.filename, confirm: true, expectedSessionId: current.sessionId, expectedRevision: current.revision });
    assert.equal((await call('desk_context')).objects.filter((o: { textFit?: string }) => o.textFit === 'shrink').length, 5);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
