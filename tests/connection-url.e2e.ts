import { respondToConfirm } from './confirm-response';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';

test('pasted URLs validate before connection, preserve confirmation and reconnect without replacing the desk', { timeout: 35_000 }, async () => {
  const { page, call, close, port, errors } = await openTestDesk('url-input');
  try {
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'kept', type: 'rect', text: 'Keep me' } }] });
    const before = await call('desk_state');
    await page.getByRole('tab', { name: '接続', exact: true }).click();
    const input = page.getByLabel('接続URL（貼り付け）', { exact: true });
    assert.equal(await input.getAttribute('type'), 'password');
    const connect = page.getByRole('button', { name: '接続', exact: true });
    let sockets = 0; page.on('websocket', () => sockets++);
    await input.fill(`http://example.com:${port}/#token=never-send-this-secret-token`);
    await connect.click();
    await page.waitForFunction(() => document.querySelector('#message')?.textContent?.includes('接続URLを確認'));
    assert.equal(sockets, 0);
    assert.equal((await call('desk_state')).sessionId, before.sessionId);
    const token = 'url-input-012345678901234567890123456789';
    const url = `http://localhost:${port}/#token=${token}&port=${port}`;
    const location = page.url();
    await input.fill(url);
    const dismissed = respondToConfirm(page, 'cancel');
    await connect.click();
    assert.equal(sockets, 0);
    await dismissed;
    assert.equal(await page.locator('#port, #token').count(), 0);
    assert.equal(await input.inputValue(), url);
    assert.equal(page.url(), location);
    await call('desk_release', { confirm: true });
    await page.waitForFunction(() => document.querySelector('#connection')?.textContent === 'AI接続解放済み');
    // Only the URL is needed for a deliberate manual return.
    await input.fill(url);
    const confirmation1 = respondToConfirm(page, 'proceed');
    await connect.click();
    await confirmation1;
    await page.waitForFunction(() => document.querySelector('#connection')?.textContent === 'MCP接続済み');
    const after = await call('desk_state');
    assert.deepEqual(after, before);
    assert.equal(sockets, 1);
    assert.equal(page.url(), location);
    // A tokenless fixed-token URL must not silently reuse previous credentials.
    await call('desk_release', { confirm: true });
    await page.waitForFunction(() => document.querySelector('#connection')?.textContent === 'AI接続解放済み');
    await input.fill(`http://127.0.0.1:${port}/`);
    await connect.click();
    await page.waitForFunction(() => document.querySelector('#message')?.textContent?.includes('#token='));
    assert.equal(sockets, 1);
    await input.fill(url);
    const confirmation2 = respondToConfirm(page, 'proceed');
    await connect.click();
    await confirmation2;
    await page.waitForFunction(() => document.querySelector('#connection')?.textContent === 'MCP接続済み');
    assert.deepEqual(await call('desk_state'), before);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
