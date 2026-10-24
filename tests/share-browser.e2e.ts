import {callTestTool} from './mcp-call';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { chromium, type Browser } from 'playwright';
import { openTestDesk } from './desk-browser';

async function freePort() {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = (server.address() as { port: number }).port;
  await new Promise<void>(resolve => server.close(() => resolve())); return port;
}

test('MCP external share lets a human follow the URL and read current context, metadata and assets without changing the desk', { timeout: 45_000 }, async () => {
  const desk = await openTestDesk('share-browser-e2e');
  let humanBrowser: Browser | undefined;
  try {
    const { client, call, page } = desk;
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/kZkAAAAASUVORK5CYII=';
    await call('desk_execute', { operations: [
      { kind: 'add', object: { id: 'share-note', type: 'rect', text: '<script>window.__sharePwned=1</script>' } },
      { kind: 'add', object: { id: 'share-image', type: 'image', src: dataUrl } },
    ] });
    const before = await call('desk_state');
    const opened = await call('desk_share_open', { confirm: true, publicBaseUrl: 'https://public.example.test', port: await freePort() });
    assert.match(opened.url, /^https:\/\/public\.example\.test\/share\//);
    assert.equal(opened.sessionId, before.sessionId); assert.equal(opened.revision, before.revision);
    const shareOrigin = `http://127.0.0.1:${opened.port}`;
    const entry = await fetch(`${shareOrigin}/share/${opened.shareId}`);
    assert.equal(entry.status, 200); assert.match(entry.headers.get('content-type') ?? '', /^text\/plain(?:;|$)/);
    const entryBody = await entry.text();
    assert.ok(entryBody.includes(opened.url));
    const entryJson = entryBody.match(/```json\s*([\s\S]*?)```/);
    assert.ok(entryJson, 'entry should include a fenced desk_context JSON snapshot');
    const entryContext = JSON.parse(entryJson[1]) as Record<string, unknown>;
    assert.equal(entryContext.name, before.name);
    assert.equal(entryContext.revision, before.revision);
    assert.equal('history' in entryContext, false);
    assert.ok(Array.isArray(entryContext.objects)); assert.equal((entryContext.objects as Record<string, unknown>[]).length, 2);
    assert.ok((entryContext.objects as Record<string, unknown>[]).every(object => !('src' in object)));
    const entryRefreshUrl = new URL((entryContext.share as { refresh: string }).refresh);
    assert.match(entryRefreshUrl.searchParams.get('read') ?? '', /^[A-Za-z0-9_-]{1,64}$/);
    const localEntryRefresh = `${shareOrigin}${entryRefreshUrl.pathname}${entryRefreshUrl.search}`;
    const refreshedEntryResponse = await fetch(localEntryRefresh);
    const refreshedEntryText = await refreshedEntryResponse.text();
    const refreshedEntryJson = refreshedEntryText.match(/```json\s*([\s\S]*?)```/);
    assert.ok(refreshedEntryJson);
    const refreshedEntry = JSON.parse(refreshedEntryJson[1]) as Record<string, unknown>;
    assert.equal(refreshedEntry.revision, before.revision);
    const htmlEntry = await fetch(`${shareOrigin}/share/${opened.shareId}?format=html`);
    assert.equal(htmlEntry.status, 200); assert.match(htmlEntry.headers.get('content-type') ?? '', /^text\/html(?:;|$)/);
    const htmlBody = await htmlEntry.text();
    assert.ok(htmlBody.includes('&lt;script&gt;window.__sharePwned=1&lt;/script&gt;'));
    assert.equal(htmlBody.includes('<script>window.__sharePwned=1</script>'), false);

    // Follow the invitation in a human tab while the owner tab remains connected to MCP.
    humanBrowser = await chromium.launch({ headless: true, executablePath: process.env.TABLETOP_CHROME ?? '/usr/bin/google-chrome' });
    const human = await humanBrowser.newPage();
    await human.goto(`${shareOrigin}/share/${opened.shareId}?format=html`);
    assert.match(await human.locator('body').innerText(), /https:\/\/public\.example\.test/);
    assert.equal(await human.locator('script').count(), 0);
    assert.equal(await human.evaluate(() => (window as unknown as { __sharePwned?: number }).__sharePwned), undefined);
    for (const href of [
      `https://public.example.test/share/${opened.shareId}/desk_context`,
      `https://public.example.test/share/${opened.shareId}/desk_get?id=OBJECT_ID`,
      `https://public.example.test/share/${opened.shareId}/desk_asset_read?id=OBJECT_ID`,
    ]) assert.equal(await human.locator(`a[href="${href}"]`).count(), 1, href);
    const hrefs = await human.locator('a[href]').evaluateAll(anchors => anchors.map(anchor => (anchor as HTMLAnchorElement).href));
    const noteHref = new URL(hrefs.find(href => new URL(href).pathname.endsWith('/desk_get') && new URL(href).searchParams.get('id') === 'share-note')!);
    const imageHref = new URL(hrefs.find(href => new URL(href).pathname.endsWith('/desk_asset_read') && new URL(href).searchParams.get('id') === 'share-image')!);
    assert.match(noteHref.searchParams.get('read') ?? '', /^[A-Za-z0-9_-]{1,64}$/);
    assert.match(imageHref.searchParams.get('read') ?? '', /^[A-Za-z0-9_-]{1,64}$/);
    assert.equal(await human.getByRole('link', { name: '最新状態を再取得' }).count(), 1);
    const contextResponse = await human.request.get(`${shareOrigin}/share/${opened.shareId}/desk_context`);
    assert.equal(contextResponse.status(), 200, await contextResponse.text());
    const context = await contextResponse.json();
    assert.equal(context.sessionId, before.sessionId); assert.equal(context.revision, before.revision);
    assert.ok(context.capturedAt); assert.equal('history' in context, false);
    assert.equal(JSON.stringify(context).includes(dataUrl.split(',')[1]), false);
    const metadata = await (await human.request.get(`${shareOrigin}/share/${opened.shareId}/desk_get?id=share-image`)).json();
    assert.equal(metadata.id, 'share-image'); assert.equal('src' in metadata, false);
    const asset = await human.request.get(`${shareOrigin}/share/${opened.shareId}/desk_asset_read?id=share-image`);
    assert.equal(asset.headers()['content-type']?.split(';')[0], 'image/png');
    assert.deepEqual([...await asset.body()], [...Buffer.from(dataUrl.split(',')[1], 'base64')]);
    assert.deepEqual(await call('desk_state'), before, 'read requests must leave browser state and revision unchanged');

    const thinkingMode = page.getByRole('switch', { name: 'ひとりで考える', exact: true });
    await thinkingMode.click();
    assert.equal(await thinkingMode.getAttribute('aria-checked'), 'true');
    const duringThinking = await human.request.get(`${shareOrigin}/share/${opened.shareId}/desk_context`);
    assert.equal(duringThinking.status(), 200, await duringThinking.text());
    assert.equal((await duringThinking.json()).sessionId, before.sessionId);
    await thinkingMode.click();

    await call('desk_execute', { operations: [{ kind: 'update', id: 'share-note', patch: { text: 'Edited version' } }] });
    const nextRefreshUrl = new URL((refreshedEntry.share as { refresh: string }).refresh);
    assert.notEqual(nextRefreshUrl.searchParams.get('read'), entryRefreshUrl.searchParams.get('read'));
    const updatedResponse = await human.request.get(`${shareOrigin}${nextRefreshUrl.pathname}${nextRefreshUrl.search}`);
    const updatedText = await updatedResponse.text();
    assert.equal(updatedResponse.status(), 200, updatedText);
    const updatedJson = updatedText.match(/```json\s*([\s\S]*?)```/);
    assert.ok(updatedJson);
    const updated = JSON.parse(updatedJson[1]) as Record<string, unknown>;
    assert.equal(updated.revision, before.revision + 1);
    assert.ok(JSON.stringify(updated).includes('Edited version'));
    const after = await call('desk_state');
    assert.equal(after.revision, updated.revision);
    const closed = await callTestTool(client, { name: 'desk_share_close', arguments: { confirm: true } });
    assert.notEqual(closed.isError, true, JSON.stringify(closed));
    assert.deepEqual(JSON.parse((closed.content as { text: string }[])[0].text), { closed: true });
    await assert.rejects(fetch(`${shareOrigin}/share/${opened.shareId}/desk_context`));
    await human.close();
  } finally { await humanBrowser?.close(); await desk.close(); }
});
