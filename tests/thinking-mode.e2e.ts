import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';
import { THINKING_MODE_REFUSAL } from '../src/thinking-mode';

test('human thinking mode gates AI actions at receipt, preserves reads/editing and reconnects without replay', { timeout: 40_000 }, async () => {
  const { page, client, call, close, errors } = await openTestDesk('thinking-mode', `
    window.__name = (fn) => fn;
    const OriginalWebSocket = window.WebSocket;
    window.WebSocket = class extends OriginalWebSocket {
      constructor(...args) { super(...args); window.testSocket = this; }
    };
  `);
  try {
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'kept', type: 'rect', text: 'Human desk' } }] });
    await call('desk_select', { ids: ['kept'] });
    await call('desk_point', { ids: ['kept'] });
    const before = await call('desk_state');
    const mode = page.getByRole('switch', { name: 'ひとりで考える', exact: true });
    assert.equal(await mode.getAttribute('aria-checked'), 'false');
    assert.equal(await mode.locator('.thinking-switch-state').textContent(), 'OFF');
    const initialWidth = (await mode.boundingBox())!.width;
    await mode.click();
    assert.equal(await mode.getAttribute('aria-checked'), 'true');
    assert.equal(await mode.locator('span').first().textContent(), 'ひとりで考える');
    assert.equal(await mode.locator('.thinking-switch-state').textContent(), 'ON');
    assert.equal((await mode.boundingBox())!.width, initialWidth);
    assert.deepEqual((await call('desk_selection')).aiPointing, []);
    assert.deepEqual((await call('desk_selection')).ids, ['kept']);
    const deny = async (name: string, args: Record<string, unknown> = {}) => {
      const result = await client.callTool({ name, arguments: args });
      assert.equal(result.isError, true, name);
      assert.ok(JSON.stringify(result).includes(THINKING_MODE_REFUSAL), JSON.stringify(result));
    };
    await deny('desk_execute', { actor: 'human', operations: [{ kind: 'delete', id: 'kept' }] });
    await deny('desk_select', { ids: [] });
    await deny('desk_point', { ids: [] });
    await deny('desk_undo'); await deny('desk_redo');
    await deny('desk_release', { confirm: true });
    assert.equal((await call('desk_pairing_info')).pairing !== null, true);
    assert.equal((await call('desk_connection_info')).browserConnected, true);
    const state = await call('desk_state');
    assert.deepEqual(state.objects, before.objects);
    assert.deepEqual(state.settings, before.settings);
    assert.equal(state.revision, before.revision);
    for (const name of ['desk_summary', 'desk_list', 'desk_settings', 'desk_context', 'desk_changes']) {
      await call(name, name === 'desk_changes' ? { sinceRevision: 0 } : {});
    }
    assert.equal((await call('desk_get', { id: 'kept' })).text, 'Human desk');
    // File snapshot and document replacement use the same bridge policy, even outside MCP tool wrappers.
    const snapshot = await page.evaluate(async () => {
      const socket = (window as unknown as { testSocket: WebSocket }).testSocket;
      const request = (id: string, payload: unknown) => new Promise<unknown>(resolve => {
        const send = socket.send;
        socket.send = data => {
          socket.send = send;
          resolve(JSON.parse(String(data)));
        };
        socket.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ id, request: payload }) }));
      });
      return {
        saved: await request('snapshot', { method: 'file_snapshot' }),
        loaded: await request('load', { method: 'load_document' }),
        unknown: await request('unknown', { method: 'future_write' }),
      };
    }) as { saved: { result: { objects: unknown[] } }; loaded: { error: string }; unknown: { error: string } };
    assert.deepEqual(snapshot.saved.result.objects, before.objects);
    assert.equal(snapshot.loaded.error, THINKING_MODE_REFUSAL);
    assert.equal(snapshot.unknown.error, THINKING_MODE_REFUSAL);
    await page.locator('#undo').click();
    assert.equal((await call('desk_summary')).count, 0);
    await page.locator('#redo').click();
    assert.equal((await call('desk_summary')).count, 1);
    // Closing the actual socket exercises ordinary automatic reconnection, not manual replacement.
    await page.evaluate(() => (window as unknown as { testSocket: WebSocket }).testSocket.close());
    await page.waitForFunction(() => document.querySelector('#connection')?.textContent === 'MCP接続済み' && (window as unknown as { testSocket: WebSocket }).testSocket.readyState === 1);
    assert.equal(await mode.getAttribute('aria-checked'), 'true');
    await deny('desk_point', { ids: ['kept'] });
    await mode.focus();
    await mode.press('Space');
    assert.equal(await mode.getAttribute('aria-checked'), 'false');
    await mode.press('Enter');
    assert.equal(await mode.getAttribute('aria-checked'), 'true');
    await mode.press('Enter');
    assert.equal(await mode.getAttribute('aria-checked'), 'false');
    assert.equal((await call('desk_summary')).count, 1);
    assert.equal((await call('desk_summary')).revision, before.revision + 2);
    await call('desk_point', { ids: ['kept'] });
    assert.deepEqual((await call('desk_selection')).aiPointing, ['kept']);
    assert.equal(await page.locator('#reaction-controls').evaluate(el => el.nextElementSibling?.id), 'grid-snap');
    assert.equal(await page.locator('#numbering-settings').evaluate(el => el.nextElementSibling?.id), 'label-descriptions');
    assert.equal(await page.locator('#label-descriptions .tool-caption').textContent(), 'ピンテキスト');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
