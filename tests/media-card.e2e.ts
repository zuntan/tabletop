import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { chromium } from 'playwright';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('media cards edit optional links and add clipboard images or safe SVG source', { timeout: 60_000 }, async () => {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = (server.address() as { port: number }).port;
  await new Promise<void>(resolve => server.close(() => resolve()));
  const token = 'media-card-test-01234567890123456789';
  const transport = new StdioClientTransport({ command: process.execPath, args: ['--import', 'tsx', 'src/server.ts'], cwd: process.cwd(),
    env: { ...Object.fromEntries(Object.entries(process.env).filter((pair): pair is [string, string] => pair[1] !== undefined)), TABLETOP_PORT: String(port), TABLETOP_TOKEN: token }, stderr: 'pipe' });
  const client = new Client({ name: 'media-card-test', version: '1.0.0' });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.TABLETOP_CHROME ?? '/usr/bin/google-chrome' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  async function call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    assert.notEqual(result.isError, true, JSON.stringify(result));
    return JSON.parse((result.content as { text: string }[])[0].text);
  }
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><script>window.svgExecuted=true</script><rect width="240" height="120" fill="orange"/></svg>';
  async function paste(source: string) {
    await page.evaluate(source => {
      const data = new DataTransfer(); data.setData('text/plain', source);
      document.querySelector('#canvas')!.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    }, source);
  }
  try {
    // Preserve esbuild's function-name helper inside serialized browser callbacks.
    await page.addInitScript('window.__name = (fn) => fn');
    await client.connect(transport); await page.goto(`http://127.0.0.1:${port}/#token=${token}&port=${port}`);
    await page.waitForFunction(() => document.querySelector('#connection')?.textContent === 'MCP接続済み');
    await paste(svg);
    await page.waitForFunction(() => document.querySelectorAll('#objects > g').length === 1);
    const id = (await call('desk_selection')).ids[0];
    const card = page.locator(`[data-id="${id}"]`);
    assert.equal(await card.locator('image').getAttribute('y'), '34');
    assert.equal(await card.locator('image').getAttribute('height'), '120');
    assert.equal(await card.locator(':scope > text').textContent(), 'クリップボード.svg');
    assert.equal(await page.evaluate(() => (window as unknown as { svgExecuted?: boolean }).svgExecuted), undefined);
    await card.locator('image').dblclick();
    await page.locator('[data-inline-text]').fill('図のタイトル');
    const destination = `http://127.0.0.1:${port}/missing-page`;
    await page.locator('[data-inline-url]').fill(destination);
    await page.locator('[data-inline-text]').press('Enter');
    assert.equal((await call('desk_get', { id })).url, destination);
    const open = card.locator('[data-open-url]');
    const beforeOpen = await call('desk_state');
    const [popup] = await Promise.all([page.waitForEvent('popup'), open.click()]);
    await popup.waitForURL(destination);
    assert.equal(await popup.evaluate(() => window.opener === null), true); await popup.close();
    assert.deepEqual(await call('desk_state'), beforeOpen);
    const box = (await card.locator('image').boundingBox())!;
    await page.mouse.move(box.x + 40, box.y + 40); await page.mouse.down();
    await page.mouse.move(box.x + 88, box.y + 64, { steps: 4 }); await page.mouse.up();
    const moved = await call('desk_get', { id });
    assert.equal(moved.x, beforeOpen.objects[0].x + 48);
    assert.equal(moved.y, beforeOpen.objects[0].y + 24);
    const handle = (await page.locator(`[data-resize="${id}"]`).boundingBox())!;
    await page.mouse.move(handle.x + 5, handle.y + 5); await page.mouse.down();
    await page.mouse.move(handle.x + 65, handle.y + 45, { steps: 4 }); await page.mouse.up();
    const resized = await call('desk_get', { id });
    assert.equal(resized.width, moved.width + 60); assert.equal(resized.height, moved.height + 40);
    assert.equal(Number(await card.locator('image').getAttribute('height')), resized.height - 34);
    await card.locator('image').dblclick();
    await page.locator('[data-inline-url]').fill('javascript:alert(1)');
    await page.locator('[data-inline-text]').press('Enter');
    assert.equal(await page.locator('.inline-editor').count(), 1);
    await page.locator('[data-inline-url]').fill(''); await page.locator('[data-inline-text]').press('Enter');
    assert.equal(await open.count(), 0); assert.equal((await call('desk_get', { id })).url, '');
    await page.locator('#undo').click(); assert.equal(await open.count(), 1);
    await page.locator('#redo').click(); assert.equal(await open.count(), 0);
    await page.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 100;
      const blob = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!)));
      Object.defineProperty(navigator.clipboard, 'read', { configurable: true, value: async () => [{ types: ['image/png'], getType: async () => blob }] });
    });
    await page.locator('#clipboard').click();
    await page.waitForFunction(() => document.querySelectorAll('#objects > g').length === 2);
    const raster = await call('desk_get', { id: (await call('desk_selection')).ids[0] });
    assert.equal(raster.type, 'image'); assert.equal(raster.height, 134);
    await page.evaluate(source => {
      Object.defineProperty(navigator.clipboard, 'read', { configurable: true, value: async () => [{ types: ['text/plain'], getType: async () => new Blob([source], { type: 'text/plain' }) }] });
    }, svg);
    await page.locator('#clipboard').click();
    await page.waitForFunction(() => document.querySelectorAll('#objects > g').length === 3);
    await page.evaluate(() => {
      Object.defineProperty(navigator.clipboard, 'read', { configurable: true, value: async () => { throw new DOMException('denied', 'NotAllowedError'); } });
    });
    await page.locator('#clipboard').click();
    await page.waitForFunction(() => document.querySelector('#message')?.textContent?.includes('読み取りを許可'));
    assert.equal((await call('desk_summary')).count, 3);
    await paste('<svg xmlns="http://www.w3.org/2000/svg"><broken></svg>');
    assert.match(await page.locator('#message').innerText(), /有効なSVG/);
    await paste('ordinary text'); assert.equal((await call('desk_summary')).count, 3);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await client.close(); await transport.close(); }
});
