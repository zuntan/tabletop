import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';

test('browser pairs and edits without secure-context crypto APIs', async () => {
  const desk = await openTestDesk('http-crypto', `
    Object.defineProperty(Crypto.prototype, 'subtle', { get: () => undefined, configurable: true });
    Object.defineProperty(Crypto.prototype, 'randomUUID', { value: undefined, configurable: true });
  `);
  try {
    assert.deepEqual(await desk.page.evaluate(() => ({ subtle: !!crypto.subtle, uuid: typeof crypto.randomUUID })), { subtle: false, uuid: 'undefined' });
    const before = await desk.call('desk_summary');
    assert.match(before.sessionId, /^[0-9a-f-]{36}$/);
    await desk.call('desk_execute', { operations: [{ kind: 'add', object: { id: 'http-text', type: 'text', text: 'HTTP browser' } }] });
    assert.equal((await desk.call('desk_summary')).count, 1);
    assert.equal((await desk.call('desk_get', { id: 'http-text' })).text, 'HTTP browser');
    assert.deepEqual(desk.errors, []);
  } finally { await desk.close(); }
});
