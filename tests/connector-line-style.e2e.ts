import {callTestTool} from './mcp-call';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';

test('line and arrow styles share the palette, persist and undo without changing bindings', { timeout: 30_000 }, async () => {
  const { page, call, close, client, errors } = await openTestDesk('connector-line-style');
  page.setDefaultTimeout(5000);
  try {
    await call('desk_execute', { operations: [
      { kind: 'add', object: { id: 'target', type: 'rect', x: 0, y: 0 } },
      ...['line', 'arrow'].map(type => ({ kind: 'add', object: { id: type, type, x: 180, y: 50, x2: 400, y2: 150, strokeWidth: 4, startBinding: { objectId: 'target', anchor: 'right' } } })),
    ] });
    for (const id of ['line', 'arrow']) {
      await call('desk_select', { ids: [id] });
      assert.equal((await call('desk_get', { id })).dash, undefined);
      const trigger = page.locator('#properties').getByRole('button', { name: '線種の候補', exact: true });
      await trigger.click();
      await page.getByRole('dialog', { name: '線種の候補', exact: true }).getByRole('button', { name: '破線', exact: true }).click();
      const line = page.locator(`[data-id="${id}"] .connector-line`);
      assert.equal(await line.getAttribute('stroke-dasharray'), '16 12');
      assert.equal((await call('desk_get', { id })).dash, 'dashed');
      await call('desk_undo');
      assert.equal(await line.getAttribute('stroke-dasharray'), null);
      assert.match(await trigger.innerText(), /実線/);
      await call('desk_execute', { operations: [{ kind: 'update', id, patch: { dash: 'dotted', strokeWidth: 8 } }] });
      assert.equal(await line.getAttribute('stroke-dasharray'), '8 16');
      assert.match(await trigger.innerText(), /点線/);
      assert.deepEqual((await call('desk_get', { id })).startBinding, { objectId: 'target', anchor: 'right' });
      if (id === 'arrow') assert.equal(await page.locator('[data-id="arrow"] .arrow-head').count(), 1);
    }
    const saved = await call('desk_save', { filename: `line-styles-${Date.now()}.tabletop` });
    await call('desk_execute', { operations: [{ kind: 'update', id: 'line', patch: { dash: 'solid' } }] });
    assert.equal(await page.locator('[data-id="line"] .connector-line').getAttribute('stroke-dasharray'), null);
    const current = await call('desk_summary');
    await call('desk_load', { filename: saved.filename, confirm: true, expectedSessionId: current.sessionId, expectedRevision: current.revision });
    assert.equal((await call('desk_get', { id: 'line' })).dash, 'dotted');
    const invalid = await callTestTool(client, { name: 'desk_execute', arguments: { operations: [{ kind: 'update', id: 'line', patch: { dash: 'invalid' } }] } });
    assert.equal(invalid.isError, true);
    await call('desk_select', { ids: ['target'] });
    assert.equal(await page.locator('#properties').getByRole('button', { name: '線種の候補', exact: true }).isVisible(), false);
    assert.equal((await call('desk_get', { id: 'target' })).dash, undefined);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
