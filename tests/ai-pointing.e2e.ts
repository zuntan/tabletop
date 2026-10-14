import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDesk } from './desk-browser';

test('green AI frames coexist with blue selection without replacing media or interrupting edits', { timeout: 45_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('ai-pointing');
  try {
    await page.route('https://example.com/**', route => route.fulfill({ body: '<p>Reference</p>', contentType: 'text/html' }));
    await call('desk_execute', { operations: [
      { kind: 'add', object: { id: 'memo', type: 'text', x: 240, y: 160, width: 260, height: 180, text: 'Memo' } },
      { kind: 'add', object: { id: 'web', type: 'web', x: 600, y: 160, url: 'https://example.com/' } },
      { kind: 'add', object: { id: 'edge', type: 'line', x: 650, y: 500, x2: 400, y2: 380 } },
    ] });
    await call('desk_select', { ids: ['memo'] });
    const revision = (await call('desk_summary')).revision;
    const iframe = await page.locator('[data-id="web"] iframe').elementHandle();
    await page.locator('[data-id="memo"] .markdown-text').dblclick();
    const input = page.locator('[data-inline-text]'); await input.fill('Uncommitted draft');
    await call('desk_point', { ids: ['memo', 'web', 'edge'] });
    const green = page.locator('[data-ai-point="memo"]');
    assert.equal(await page.locator('[data-ai-point]').count(), 3);
    assert.equal(await green.getAttribute('stroke'), '#15803d');
    assert.equal(await green.getAttribute('stroke-dasharray'), '1 4');
    assert.equal(await green.getAttribute('stroke-linecap'), 'round');
    assert.equal(await green.getAttribute('x'), '233');
    assert.equal(await green.getAttribute('pointer-events'), 'none');
    assert.equal(await green.getAttribute('data-resize'), null);
    assert.equal(await page.locator('[data-resize="memo"]').count(), 1);
    assert.equal(await input.inputValue(), 'Uncommitted draft');
    assert.equal(await input.evaluate(element => element === document.activeElement), true);
    assert.equal(await iframe!.evaluate(element => element === document.querySelector('[data-id="web"] iframe')), true);
    assert.equal(await page.locator('[data-ai-point="edge"]').getAttribute('x'), '393');
    assert.equal(await page.locator('[data-ai-point="edge"]').getAttribute('y'), '373');
    assert.deepEqual((await call('desk_selection')).ids, ['memo']);
    assert.deepEqual((await call('desk_context')).aiPointing, ['memo', 'web', 'edge']);
    assert.equal((await call('desk_summary')).revision, revision);
    await input.press('Escape');
    await page.locator('#zoom-in').click();
    assert.equal(Number(await green.getAttribute('stroke-width')), 1.6);
    assert.equal(await green.getAttribute('stroke-dasharray'), '0.8 3.2');
    assert.equal(Number(await green.getAttribute('x')), 240 - 7 / 1.25);
    await page.locator('#zoom-reset').click();
    await call('desk_point', { ids: [] }); assert.equal(await page.locator('[data-ai-point]').count(), 0);
    await call('desk_point', { ids: ['memo'] });
    await call('desk_execute', { operations: [{ kind: 'update', id: 'memo', patch: { x: 270 } }] });
    assert.equal(await green.getAttribute('x'), '263');
    await call('desk_execute', { operations: [{ kind: 'delete', id: 'memo' }] });
    assert.equal(await page.locator('[data-ai-point]').count(), 0);
    await call('desk_undo'); assert.equal(await page.locator('[data-ai-point]').count(), 0);
    // AI-only pointing must not introduce human editing handles or select a target on clear.
    await call('desk_select', { ids: [] }); await call('desk_point', { ids: ['memo'] });
    assert.equal(await page.locator('[data-resize]').count(), 0);
    await page.locator('[data-id="memo"] .markdown-text').click();
    assert.deepEqual((await call('desk_selection')).ids, ['memo']);
    // Reconnecting clears session-local pointing without touching committed objects.
    await page.locator('#connect-form').evaluate(element => (element as HTMLFormElement).requestSubmit());
    await page.waitForFunction(() => document.querySelector('#connection')?.textContent === 'MCP接続済み');
    assert.deepEqual((await call('desk_selection')).aiPointing, []);
    assert.equal(await page.locator('[data-ai-point]').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
