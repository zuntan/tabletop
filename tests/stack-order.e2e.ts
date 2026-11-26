import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDesk } from './desk-browser';

test('toolbar and MCP share step ordering, paper ordering and Undo', { timeout: 45_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('stack-order');
  try {
    await call('desk_execute', { operations: ['a', 'gap', 'b'].map(id => ({ kind: 'add', object: {
      id, type: 'text', text: id, x: id === 'gap' ? 1000 : 0, y: 0, width: 200, height: 150,
    } })) });
    await call('desk_select', { ids: ['a'] });
    await page.locator('#forward').click();
    assert.deepEqual((await call('desk_list')).objects.map((o: { id: string }) => o.id), ['gap', 'b', 'a']);
    const revision = (await call('desk_summary')).revision;
    await page.locator('#forward').click();
    assert.equal((await call('desk_summary')).revision, revision);
    await page.locator('#backward').click();
    assert.deepEqual((await call('desk_list')).objects.map((o: { id: string }) => o.id), ['gap', 'a', 'b']);
    await call('desk_execute', { operations: [{ kind: 'add', object: {
      id: 'clip', type: 'clip', clipMembers: ['a', 'b'], clipOffset: 500,
    } }] });
    await call('desk_select', { ids: ['b'] });
    const clip = await call('desk_get', { id: 'clip' });
    await page.locator('#back').click();
    const after = await call('desk_get', { id: 'clip' });
    assert.deepEqual(after.clipMembers, ['b', 'a']);
    assert.equal(after.x, clip.x); assert.equal(after.y, clip.y);
    await call('desk_undo');
    assert.deepEqual((await call('desk_get', { id: 'clip' })).clipMembers, ['a', 'b']);
    await call('desk_execute', { operations: [{ kind: 'order', ids: ['b'], direction: 'back' }] });
    assert.deepEqual((await call('desk_get', { id: 'clip' })).clipMembers, ['b', 'a']);
    await call('desk_execute', { operations: [{ kind: 'update', id: 'clip', patch: { locked: true } }] });
    assert.equal(await page.locator('#forward').isDisabled(), true);
    assert.equal(await page.locator('#front').isDisabled(), true);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
