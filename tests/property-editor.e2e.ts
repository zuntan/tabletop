import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';

test('properties commit per field on Enter or blur, reject incomplete numbers, and undo once', { timeout: 30_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('property-editor');
  try {
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'card', type: 'text', text: 'Original' } }] });
    await call('desk_select', { ids: ['card'] });
    const form = page.locator('#properties'), size = form.locator('[name="fontSize"]');
    assert.equal(await form.locator('[type="submit"]').count(), 0);
    const revision = (await call('desk_summary')).revision;
    await size.fill('48');
    assert.equal((await call('desk_get', { id: 'card' })).fontSize, 24);
    await size.press('Enter');
    assert.equal((await call('desk_get', { id: 'card' })).fontSize, 48);
    assert.equal((await call('desk_summary')).revision, revision + 1);
    await size.press('Tab');
    assert.equal((await call('desk_summary')).revision, revision + 1);
    await call('desk_undo'); assert.equal((await call('desk_get', { id: 'card' })).fontSize, 24);
    const beforeInvalid = (await call('desk_summary')).revision;
    await size.fill(''); await size.press('Enter');
    assert.equal((await call('desk_summary')).revision, beforeInvalid);
    assert.equal(await size.inputValue(), '24');
    await size.fill('1001'); await size.press('Tab');
    assert.equal((await call('desk_get', { id: 'card' })).fontSize, 24);
    const text = form.locator('[name="text"]');
    await text.fill('First'); await text.press('End'); await text.press('Enter'); await text.pressSequentially('Second');
    assert.equal((await call('desk_get', { id: 'card' })).text, 'Original');
    await text.press('Tab');
    assert.equal((await call('desk_get', { id: 'card' })).text, 'First\nSecond');
    await call('desk_undo'); assert.equal((await call('desk_get', { id: 'card' })).text, 'Original');
    await text.fill('Cancel this'); await text.press('Escape'); await text.press('Tab');
    assert.equal((await call('desk_get', { id: 'card' })).text, 'Original');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('property drafts survive unrelated edits, detect same-field conflicts and never spill into another selection', { timeout: 30_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('property-editor-conflict');
  try {
    await call('desk_execute', { operations: [
      { kind: 'add', object: { id: 'a', type: 'text', text: 'A' } },
      { kind: 'add', object: { id: 'b', type: 'text', x: 400, text: 'B' } },
    ] });
    await call('desk_select', { ids: ['a'] });
    const text = page.locator('#properties [name="text"]');
    await text.fill('Draft');
    await call('desk_execute', { operations: [{ kind: 'update', id: 'a', patch: { x: 50 } }] });
    assert.equal(await text.inputValue(), 'Draft');
    await text.press('Tab');
    assert.equal((await call('desk_get', { id: 'a' })).text, 'Draft');
    assert.equal((await call('desk_get', { id: 'a' })).x, 50);
    await text.fill('Stale');
    await call('desk_execute', { operations: [{ kind: 'update', id: 'a', patch: { text: 'External' } }] });
    assert.equal(await text.inputValue(), 'Stale');
    await text.press('Tab');
    assert.equal((await call('desk_get', { id: 'a' })).text, 'External');
    assert.match(await page.locator('#message').innerText(), /編集中/);
    await text.fill('Wrong target');
    await call('desk_select', { ids: ['b'] });
    await text.press('Tab');
    assert.equal((await call('desk_get', { id: 'b' })).text, 'B');
    assert.equal((await call('desk_get', { id: 'a' })).text, 'External');
    await text.focus(); await text.dispatchEvent('compositionstart'); await text.fill('日本語');
    await text.dispatchEvent('keydown', { key: 'Enter', isComposing: true, keyCode: 229 });
    assert.equal((await call('desk_get', { id: 'b' })).text, 'B');
    await text.dispatchEvent('compositionend'); await text.press('Tab');
    assert.equal((await call('desk_get', { id: 'b' })).text, '日本語');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
