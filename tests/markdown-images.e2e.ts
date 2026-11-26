import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openTestDesk } from './desk-browser';
import { callTestTool } from './mcp-call';

test('Markdown images render external and live local media, preview, fallbacks, archives and exports', { timeout: 60_000 }, async () => {
  const red = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="#ff0000"/></svg>';
  const server = createServer((request, response) => {
    if (request.url === '/missing') { response.writeHead(404); response.end(); return; }
    response.setHeader('Content-Type', 'image/svg+xml');
    if (request.url !== '/no-cors') response.setHeader('Access-Control-Allow-Origin', '*');
    response.end(red);
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const { page, call, client, close, errors } = await openTestDesk('markdown-images');
  const directory = await mkdtemp(join(tmpdir(), 'tabletop-md-images-'));
  try {
    const src = 'data:image/svg+xml;base64,' + Buffer.from(red).toString('base64');
    const source = `![external](${base}/image)\n\n![local](tabletop://./picture)\n\n![diagram](tabletop://./diagram)\n\n![qr](tabletop://./qr)\n\n![text](tabletop://./plain)\n\n![missing](tabletop://./absent)\n\n![broken](${base}/missing)\n\n![other](tabletop://other/picture)`;
    await call('desk_execute', { operations: [
      { kind: 'add', object: { id: 'picture', type: 'svg', src, x: 1000, y: 100, width: 400, height: 234 } },
      { kind: 'add', object: { id: 'diagram', type: 'mermaid', mermaidSource: 'flowchart LR\nA --> B', x: 1000, y: 400 } },
      { kind: 'add', object: { id: 'qr', type: 'qrcode', qrText: 'Tabletop', x: 1500, y: 100 } },
      { kind: 'add', object: { id: 'plain', type: 'text', text: 'Not an image', x: 1500, y: 400 } },
      { kind: 'add', object: { id: 'memo', type: 'text', text: source, x: 0, y: 0, width: 320, height: 2200 } },
    ] });
    const host = page.locator('[data-id="memo"] .markdown-text');
    await page.waitForFunction(() => document.querySelectorAll('[data-id="memo"] [data-image-status="ready"]').length === 4 && document.querySelectorAll('[data-id="memo"] [data-image-status="error"]').length === 4);
    assert.equal(await host.locator('img').count(), 4);
    assert.match(await host.innerText(), /画像を表示できません — text/);
    const size = await host.locator('img').first().evaluate(img => ({ width: img.getBoundingClientRect().width, height: img.getBoundingClientRect().height, available: img.closest('.markdown-text')!.getBoundingClientRect().width }));
    assert.ok(size.width <= size.available); assert.ok(Math.abs(size.width / size.height - 2) < .01);
    assert.equal((await call('desk_get', { id: 'memo' })).height, 2200);
    // Both the live reference and its original share the same generated source.
    assert.equal(await host.locator('[data-image-alt="diagram"] img').getAttribute('src'), await page.locator('[data-id="diagram"] .mermaid-image').getAttribute('href'));
    const green = 'data:image/svg+xml;base64,' + Buffer.from(red.replace('#ff0000', '#00ff00')).toString('base64');
    await call('desk_execute', { operations: [{ kind: 'update', id: 'picture', patch: { src: green } }] });
    await page.waitForFunction(expected => document.querySelector('[data-id="memo"] [data-image-alt="local"] img')?.getAttribute('src') === expected, green);
    await page.locator('[data-id="memo"] .markdown-text').dblclick({ position: { x: 10, y: 10 } });
    await page.locator('.inline-editor .editor-preview-toggle').hover(); await page.mouse.down();
    await page.waitForFunction(() => document.querySelectorAll('.inline-editor .editor-markdown-preview img').length === 4);
    await page.mouse.up(); await page.locator('[data-inline-text]').press('Escape');
    const saved = await call('desk_save', { path: join(directory, 'images.tabletop') });
    await call('desk_execute', { operations: [{ kind: 'delete', id: 'picture' }] });
    await page.waitForFunction(() => document.querySelector('[data-id="memo"] [data-image-alt="local"]')?.getAttribute('data-image-status') === 'error');
    await call('desk_undo');
    await page.waitForFunction(() => document.querySelector('[data-id="memo"] [data-image-alt="local"]')?.getAttribute('data-image-status') === 'ready');
    const summary = await call('desk_summary');
    await call('desk_load', { path: saved.path, confirm: true, expectedRevision: summary.revision, expectedSessionId: summary.sessionId });
    await page.waitForFunction(() => document.querySelectorAll('[data-id="memo"] [data-image-status="ready"]').length === 4);
    assert.equal((await call('desk_get', { id: 'memo' })).text, source);
    // Capture a single external image and check the pixels, not just successful file creation.
    await call('desk_execute', { operations: [{ kind: 'update', id: 'memo', patch: { text: `![red](${base}/image)`, width: 320, height: 240, padding: 0 } }] });
    await page.waitForFunction(() => document.querySelector('[data-id="memo"] [data-image-status="ready"]'));
    const result = await callTestTool(client, { name: 'desk_raster', arguments: { ids: ['memo'], path: join(directory, 'image.png') } });
    assert.notEqual(result.isError, true, JSON.stringify(result));
    const png = (result.content as any[]).find(item => item.type === 'image');
    const pixel = await page.evaluate(async data => {
      const img = new Image(); img.src = data; await img.decode(); const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0); return Array.from(ctx.getImageData(30, 30, 1, 1).data);
    }, `data:image/png;base64,${png.data}`);
    assert.deepEqual(pixel, [255, 0, 0, 255]);
    await call('desk_execute', { operations: [{ kind: 'update', id: 'memo', patch: { text: '![green](tabletop://./picture)' } }] });
    await page.waitForFunction(() => document.querySelector('[data-id="memo"] [data-image-status="ready"]'));
    const localResult = await callTestTool(client, { name: 'desk_raster', arguments: { ids: ['memo'], path: join(directory, 'local.png') } });
    assert.notEqual(localResult.isError, true, JSON.stringify(localResult));
    const localPng = (localResult.content as any[]).find(item => item.type === 'image');
    const greenPixel = await page.evaluate(async data => {
      const img = new Image(); img.src = data; await img.decode(); const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0); return Array.from(ctx.getImageData(30, 30, 1, 1).data);
    }, `data:image/png;base64,${localPng.data}`);
    assert.deepEqual(greenPixel, [0, 255, 0, 255]);
    assert.ok((await call('desk_pdf', { path: join(directory, 'images.pdf') })).bytes > 0);
    // Display may work without CORS; export must show a fallback rather than silently losing pixels.
    await call('desk_execute', { operations: [{ kind: 'update', id: 'memo', patch: { text: `![restricted](${base}/no-cors)` } }] });
    await page.waitForFunction(() => document.querySelector('[data-id="memo"] [data-image-status="ready"]'));
    assert.ok((await call('desk_pdf', { path: join(directory, 'restricted.pdf') })).bytes > 0);
    assert.deepEqual(errors, []);
  } finally { await close(); server.close(); await rm(directory, { recursive: true, force: true }); }
});
