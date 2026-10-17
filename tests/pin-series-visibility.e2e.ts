import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';

test('pin-series panel is limited to pin-only selections and stays hidden at the empty initial state', { timeout: 30_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('pin-series-visibility');
  try {
    const panel = page.locator('#series-panel');
    assert.equal(await panel.isVisible(), false);
    await call('desk_execute', { operations: [
      { kind: 'add', object: { id: 'memo', type: 'text', x: 100, y: 100, width: 180, height: 100, text: 'Memo' } },
      { kind: 'label_add', id: 'pin-a', seriesId: 'series-1', x: 300, y: 100 },
      { kind: 'label_add', id: 'pin-b', seriesId: 'series-1', x: 400, y: 100 },
    ] });
    await call('desk_select', { ids: ['memo'] });
    assert.equal(await panel.isVisible(), false);
    await call('desk_select', { ids: ['pin-a'] });
    assert.equal(await panel.isVisible(), true);
    await call('desk_select', { ids: ['pin-a', 'pin-b'] });
    assert.equal(await panel.isVisible(), true);
    await call('desk_select', { ids: ['pin-a', 'memo'] });
    assert.equal(await panel.isVisible(), false);
    await call('desk_select', { ids: [] });
    assert.equal(await panel.isVisible(), false);
    await call('desk_undo');
    assert.equal((await call('desk_summary')).count, 0);
    assert.deepEqual((await call('desk_selection')).ids, []);
    assert.equal(await panel.isVisible(), false);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
