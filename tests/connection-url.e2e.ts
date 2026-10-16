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
    assert.ok((await page.locator('#message').textContent())!.includes('接続URLを確認'));
    assert.equal(sockets, 0);
    assert.equal((await call('desk_state')).sessionId, before.sessionId);
    const token = 'url-input-012345678901234567890123456789';
    const url = `http://localhost:${port}/#token=${token}&port=${port}`;
    const location = page.url();
    await input.fill(url);
    page.once('dialog', dialog => dialog.dismiss());
    await connect.click();
    assert.equal(sockets, 0);
    assert.equal(await page.locator('#port').inputValue(), String(port));
    assert.equal(await page.locator('#token').inputValue(), token);
    assert.equal(await input.inputValue(), '');
    assert.equal(page.url(), location);
    await call('desk_release', { confirm: true });
    await page.waitForFunction(() => document.querySelector('#connection')?.textContent === 'AI接続解放済み');
    // A pasted URL takes precedence over stale or invalid values in the manual fields.
    await page.locator('#port').fill('0'); await page.locator('#token').fill('old');
    await input.fill(url);
    page.once('dialog', dialog => dialog.accept());
    await connect.click();
    await page.waitForFunction(() => document.querySelector('#connection')?.textContent === 'MCP接続済み');
    const after = await call('desk_state');
    assert.deepEqual(after, before);
    assert.equal(sockets, 1);
    assert.equal(page.url(), location);
    // Fixed-token URLs without a fragment retain the separately entered token.
    await call('desk_release', { confirm: true });
    await page.waitForFunction(() => document.querySelector('#connection')?.textContent === 'AI接続解放済み');
    await input.fill(`http://127.0.0.1:${port}/`);
    page.once('dialog', dialog => dialog.accept());
    await connect.click();
    await page.waitForFunction(() => document.querySelector('#connection')?.textContent === 'MCP接続済み');
    assert.deepEqual(await call('desk_state'), before);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
