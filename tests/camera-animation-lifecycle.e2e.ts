import {callTestTool} from './mcp-call';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';

const captureSocket = `window.cameraSockets = [];
const OriginalWebSocket = window.WebSocket;
window.WebSocket = class extends OriginalWebSocket {
  constructor(...args) { super(...args); window.cameraSockets.push(this); }
};`;

test('superseding commands, visibility, sidebar resize and disconnect stop old flights without replay', { timeout: 30_000 }, async () => {
  const { page, call, client, close, errors } = await openTestDesk('camera-flight-lifecycle', captureSocket);
  const transform = () => page.locator('#viewport').getAttribute('transform');
  async function start() {
    const before = await transform();
    const pending = callTestTool(client, { name: 'desk_camera_move', arguments: { pan: { x: 5000, y: 1000 }, durationMs: 2000 } });
    await page.waitForFunction(before => document.querySelector('#viewport')!.getAttribute('transform') !== before, before);
    return { pending };
  }
  async function frozen() {
    await page.waitForTimeout(80);
    const stopped = await transform();
    await page.waitForTimeout(180);
    assert.equal(await transform(), stopped);
  }
  try {
    const first = await start();
    await call('desk_camera_move', { center: { x: 50, y: 100 }, durationMs: 0 });
    assert.match(JSON.stringify(await first.pending), /Superseded/);
    await frozen();
    const center = (await call('desk_camera_get')).center;
    assert.ok(Math.abs(center.x - 50) < 1e-8 && Math.abs(center.y - 100) < 1e-8);

    const visible = await start();
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    assert.equal((await visible.pending).isError, true); await frozen();

    const resize = await start();
    // Change actual canvas geometry without a window resize or pointer/click event.
    await page.locator('main').evaluate(el => { el.style.gridTemplateColumns = 'minmax(0, 1fr) 450px'; });
    assert.equal((await resize.pending).isError, true); await frozen();

    const disconnected = await start();
    await page.evaluate(() => {
      const sockets = (window as unknown as { cameraSockets: WebSocket[] }).cameraSockets;
      sockets.at(-1)!.close();
    });
    assert.equal((await disconnected.pending).isError, true); await frozen();
    await page.waitForFunction(() => document.querySelector('#connection')?.textContent === 'MCP接続済み');
    await frozen(); assert.deepEqual(errors, []);
  } finally { await close(); }
});
