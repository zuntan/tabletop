import { respondToConfirm } from './confirm-response';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';
import { readFile } from 'node:fs/promises';
import { decodeDeskFile } from '../src/desk-file';

test('small URL controls preserve the desk; local-only handoff fails without releasing', { timeout: 30_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('handoff-local');
  try {
    const before = await call('desk_state');
    await page.getByRole('tab', { name: '接続', exact: true }).click();
    const input = page.locator('#connection-url');
    const value = await input.inputValue();
    await page.getByRole('button', { name: 'URLを表示', exact: true }).click();
    assert.equal(await input.getAttribute('type'), 'text');
    assert.equal(await input.inputValue(), value);
    await page.getByRole('button', { name: 'URLを隠す', exact: true }).click();
    assert.equal(await input.getAttribute('type'), 'password');
    await page.getByRole('button', { name: 'URLをクリア', exact: true }).click();
    assert.equal(await input.inputValue(), '');
    assert.equal(await input.evaluate(el => el === document.activeElement), true);
    const confirmation1 = respondToConfirm(page, 'proceed');
    await page.getByRole('button', { name: '別端末へ渡す', exact: true }).click();
    await confirmation1;
    await page.waitForFunction(() => document.querySelector('#message')?.textContent?.includes('引き渡しできません'));
    assert.deepEqual(await call('desk_state'), before);
    assert.equal((await call('desk_connection_info')).network.lanEnabled, false);
    assert.equal(await page.locator('#handoff-panel').isVisible(), false);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

// Advertise a synthetic loopback destination; the real listener NEVER binds a LAN address.
const loopbackLan = `import { NetworkAccess } from './src/network-access.ts';
const info = NetworkAccess.prototype.info;
NetworkAccess.prototype.info = function() { return { ...info.call(this), lanEnabled: true, lanAddresses: ['127.0.0.1'] }; }`;

test('authenticated human handoff renders a private QR and pairs a second empty desk once', { timeout: 35_000 }, async () => {
  const { page, call, close, port, errors } = await openTestDesk('handoff-positive', undefined, loopbackLan);
  try {
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'kept', type: 'text', text: 'Original desk' } }] });
    const before = await call('desk_state');
    let handoffUrl = '';
    // Observe only this isolated test's synthetic credentials, never the live browser.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    cdp.on('Network.webSocketFrameReceived', event => {
      const value = JSON.parse(event.response.payloadData);
      if (value.type === 'release') handoffUrl = value.handoffUrl;
    });
    await page.getByRole('tab', { name: '接続', exact: true }).click();
    const confirmation2 = respondToConfirm(page, 'cancel');
    await page.getByRole('button', { name: '別端末へ渡す', exact: true }).click();
    await confirmation2;
    assert.deepEqual(await call('desk_state'), before);
    // Human-initiated handoff remains available in read-only AI thinking mode.
    await page.locator('#thinking-mode').click();
    const confirmation3 = respondToConfirm(page, 'proceed');
    await page.getByRole('button', { name: '別端末へ渡す', exact: true }).click();
    await confirmation3;
    await page.locator('#handoff-panel').waitFor({ state: 'visible' });
    assert.match(handoffUrl, new RegExp(`^http://127.0.0.1:${port}/#token=`));
    assert.equal(handoffUrl.includes('handoff-positive'), false);
    assert.equal(await page.locator('#connection').textContent(), 'AI接続解放済み');
    const pixels = await page.locator('#handoff-qr').evaluate((el: HTMLCanvasElement) => {
      const data = el.getContext('2d')!.getImageData(0, 0, el.width, el.height).data;
      return { width: el.width, black: data.some((value, index) => index % 4 === 0 && value === 0), white: data.some((value, index) => index % 4 === 0 && value === 255) };
    });
    assert.deepEqual(pixels, { width: 256, black: true, white: true });
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#file-menu').click(); await page.locator('#download-desk').click();
    const downloaded = await downloadPromise;
    const saved = await decodeDeskFile(await readFile((await downloaded.path())!));
    assert.deepEqual(saved.objects, before.objects);
    assert.equal(JSON.stringify(saved).includes(handoffUrl), false);
    const next = await page.context().browser()!.newPage();
    await next.goto(handoffUrl);
    await next.waitForFunction(() => document.querySelector('#connection')?.textContent === 'MCP接続済み');
    assert.equal((await call('desk_summary',{deskId:await next.locator('#desk-id').textContent()})).count, 0);
    await call('desk_release', {deskId:await next.locator('#desk-id').textContent(),confirm: true });
    // Opening another acceptance epoch does not revive the consumed ticket.
    const replay = await page.context().browser()!.newPage();
    await replay.goto(handoffUrl);
    await replay.waitForTimeout(1200);
    assert.equal((await call('desk_connection_info')).browserConnected, false);
    await page.getByRole('button', { name: 'QRを隠す', exact: true }).click();
    assert.equal(await page.locator('#handoff-panel').isVisible(), false);
    assert.equal(await page.locator('#handoff-qr').getAttribute('width'), '0');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
