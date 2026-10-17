import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { request as httpRequest } from 'node:http';
import { once } from 'node:events';
import { DeskShareServer } from '../src/share-server';
import { Desk, dispatch, type Request as DeskRequest } from '../src/model';

async function freePort() {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = (server.address() as { port: number }).port;
  await new Promise<void>(resolve => server.close(() => resolve())); return port;
}
async function requestWithHost(port: number, path: string, host: string) {
  return new Promise<number>((resolve, reject) => {
    const req = httpRequest({ hostname: '127.0.0.1', port, path, headers: { host } }, res => {
      res.resume(); res.on('end', () => resolve(res.statusCode ?? 0));
    });
    req.on('error', reject); req.end();
  });
}

test('external read share serves only the selected session and rejects unsafe HTTP requests', { timeout: 15_000 }, async () => {
  let desk = new Desk();
  desk.execute({ operations: [
    { kind: 'add', object: { id: 'note', type: 'rect', text: 'Human text', x: 12 } },
    { kind: 'add', object: { id: 'png', type: 'image', src: 'data:image/png;base64,iVBORw0KGgo=' } },
    { kind: 'add', object: { id: 'svg', type: 'svg', src: `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64')}` } },
    { kind: 'add', object: { id: 'remote', type: 'image', src: 'https://example.invalid/image.png' } },
  ] });
  const sessionId = desk.sessionId, connection = {};
  let currentConnection: object | null = connection;
  const request = async (message: DeskRequest) => dispatch(desk, message);
  const share = new DeskShareServer(request, () => currentConnection);
  const opened = await share.open({ confirm: true, publicBaseUrl: 'https://share.example.test', port: await freePort() });
  const origin = `http://127.0.0.1:${opened.port}`;
  try {
    assert.equal(opened.sessionId, sessionId); assert.equal(opened.revision, desk.revision);
    assert.equal(opened.url, `https://share.example.test/share/${opened.shareId}`);
    const entry = await fetch(`${origin}/share/${opened.shareId}`);
    assert.equal(entry.status, 200); assert.match(entry.headers.get('content-type') ?? '', /^text\/plain(?:;|$)/);
    const entryBody = await entry.text();
    assert.match(entryBody, /https:\/\/share\.example\.test\/share\//);
    const entryJson = entryBody.match(/```json\s*([\s\S]*?)```/);
    assert.ok(entryJson, 'entry should include a fenced desk_context JSON snapshot');
    const entryContext = JSON.parse(entryJson[1]) as Record<string, unknown>;
    assert.equal(entryContext.name, desk.summary().name);
    assert.equal(entryContext.revision, desk.revision);
    assert.equal('history' in entryContext, false);
    assert.ok(Array.isArray(entryContext.objects)); assert.equal((entryContext.objects as Record<string, unknown>[]).length, 4);
    assert.ok((entryContext.objects as Record<string, unknown>[]).every(object => !('src' in object)));
    const contextResponse = await fetch(`${origin}/share/${opened.shareId}/desk_context`);
    assert.equal(contextResponse.status, 200);
    const context = await contextResponse.json() as Record<string, unknown>;
    assert.equal(context.sessionId, sessionId); assert.equal(context.revision, desk.revision);
    assert.ok(context.capturedAt); assert.equal('history' in context, false);
    assert.equal(JSON.stringify(context).includes('iVBORw0KGgo='), false);
    const metadataResponse = await fetch(`${origin}/share/${opened.shareId}/desk_get?id=png`);
    const metadata = await metadataResponse.json() as Record<string, unknown>;
    assert.equal(metadata.id, 'png'); assert.equal('src' in metadata, false);
    assert.equal(metadata.sessionId, sessionId); assert.equal(metadata.revision, desk.revision); assert.ok(metadata.capturedAt);
    const assetResponse = await fetch(`${origin}/share/${opened.shareId}/desk_asset_read?id=png`);
    assert.equal(assetResponse.status, 200); assert.equal(assetResponse.headers.get('content-type')?.split(';')[0], 'image/png');
    assert.deepEqual([...new Uint8Array(await assetResponse.arrayBuffer())], [...Buffer.from('iVBORw0KGgo=', 'base64')]);
    const svgResponse = await fetch(`${origin}/share/${opened.shareId}/desk_asset_read?id=svg`);
    assert.equal(svgResponse.headers.get('content-type')?.split(';')[0], 'text/plain');
    assert.match(await svgResponse.text(), /^<svg/);
    assert.equal((await fetch(`${origin}/share/${opened.shareId}/desk_asset_read?id=remote`)).status, 422);
    for (const url of [
      `${origin}/unknown`, `${origin}/share/unknown-token/desk_context`, `${origin}/share/${opened.shareId}/desk_execute`,
      `${origin}/share/${opened.shareId}/desk_get?id=note&exportFile=true`,
      `${origin}/share/${opened.shareId}/desk_get`, `${origin}/share/${opened.shareId}/desk_context?x=1`,
    ]) assert.ok([400, 404].includes((await fetch(url)).status), url);
    assert.ok([400, 404, 405].includes((await fetch(`${origin}/share/${opened.shareId}/desk_context`, { method: 'POST' })).status));
    assert.equal(await requestWithHost(opened.port, `/share/${opened.shareId}/desk_context`, 'evil.example'), 403);
    currentConnection = {}; assert.equal((await fetch(`${origin}/share/${opened.shareId}/desk_context`)).status, 410);
    currentConnection = connection; await share.close();
    desk = new Desk();
    const replacement = await share.open({ confirm: true, publicBaseUrl: 'https://share.example.test', port: opened.port });
    assert.notEqual(replacement.sessionId, sessionId);
    desk = new Desk();
    const replacedUrl = `${origin}/share/${replacement.shareId}/desk_context`;
    assert.equal((await fetch(replacedUrl)).status, 410);
    assert.equal((await fetch(replacedUrl)).status, 404);
  } finally { await share.close(); }
  assert.deepEqual(await share.close(), { closed: true });
});

test('external read share caps request rate and concurrent reads', { timeout: 15_000 }, async () => {
  const sessionId = '00000000-0000-4000-8000-000000000002';
  const connection = {};
  let hold = false, startedCount = 0;
  const releases: (() => void)[] = [];
  const startedWaiters: (() => void)[] = [];
  const request = async (payload: DeskRequest) => {
    if (payload.method === 'summary') return { sessionId, revision: 0 };
    if (payload.method !== 'share_read') throw new Error('Unexpected request');
    if (hold) {
      startedCount++;
      startedWaiters.splice(0).forEach(resolve => resolve());
      await new Promise<void>(resolve => releases.push(resolve));
    }
    return { sessionId, revision: 0, capturedAt: new Date().toISOString(), objects: [] };
  };
  const share = new DeskShareServer(request, () => connection);
  const opened = await share.open({ confirm: true, publicBaseUrl: 'https://share.example.test', port: await freePort() });
  const url = `http://127.0.0.1:${opened.port}/share/${opened.shareId}/desk_context`;
  try {
    for (let i = 0; i < 60; i++) assert.equal((await fetch(url)).status, 200);
    assert.equal((await fetch(url)).status, 429);
  } finally { await share.close(); }

  let holdConcurrent = false;
  const concurrent = new DeskShareServer(async payload => {
    if (payload.method === 'summary') return { sessionId, revision: 0 };
    if (payload.method === 'share_read') {
      if (holdConcurrent) {
        startedCount++;
        if (startedCount >= 4) startedWaiters.splice(0).forEach(resolve => resolve());
        await new Promise<void>(resolve => releases.push(resolve));
      }
      return { sessionId, revision: 0, capturedAt: new Date().toISOString(), objects: [] };
    }
    throw new Error('Unexpected request');
  }, () => connection);
  const second = await concurrent.open({ confirm: true, publicBaseUrl: 'https://share.example.test', port: await freePort() });
  const secondUrl = `http://127.0.0.1:${second.port}/share/${second.shareId}/desk_context`;
  try {
    startedCount = 0; holdConcurrent = true;
    const waitForFourth = new Promise<void>(resolve => startedWaiters.push(resolve));
    const pending = Array.from({ length: 4 }, () => fetch(secondUrl));
    await waitForFourth;
    assert.equal((await fetch(secondUrl)).status, 429);
    releases.splice(0).forEach(resolve => resolve());
    assert.deepEqual((await Promise.all(pending)).map(response => response.status), [200, 200, 200, 200]);
  } finally { await concurrent.close(); }
});

test('closing during a pending read revokes the response before any content is returned', { timeout: 10_000 }, async () => {
  const sessionId = '00000000-0000-4000-8000-000000000003', connection = {};
  let hold = false, release!: () => void, started!: () => void;
  const waiting = new Promise<void>(resolve => { started = resolve; });
  const request = async (payload: DeskRequest) => {
    if (payload.method === 'summary') return { sessionId, revision: 0 };
    if (payload.method !== 'share_read') throw new Error('Unexpected request');
    if (hold) { started(); await new Promise<void>(resolve => { release = resolve; }); }
    return { sessionId, revision: 0, capturedAt: new Date().toISOString(), objects: [], privateText: 'must never escape' };
  };
  const share = new DeskShareServer(request, () => connection);
  const opened = await share.open({ confirm: true, publicBaseUrl: 'https://share.example.test', port: await freePort() });
  hold = true;
  const pending = fetch(`http://127.0.0.1:${opened.port}/share/${opened.shareId}/desk_context`);
  await waiting;
  const closing = share.close();
  release();
  await closing;
  const response = await pending;
  assert.equal(response.status, 410);
  assert.equal((await response.text()).includes('must never escape'), false);
});

test('external JSON response larger than 4 MiB is rejected', { timeout: 10_000 }, async () => {
  const sessionId = '00000000-0000-4000-8000-000000000004', connection = {};
  const request = async (payload: DeskRequest) => {
    if (payload.method === 'summary') return { sessionId, revision: 0 };
    if (payload.method !== 'share_read') throw new Error('Unexpected request');
    return { sessionId, revision: 0, capturedAt: new Date().toISOString(), objects: [], extra: 'x'.repeat(4 * 1024 * 1024) };
  };
  const share = new DeskShareServer(request, () => connection);
  const opened = await share.open({ confirm: true, publicBaseUrl: 'https://share.example.test', port: await freePort() });
  try {
    const response = await fetch(`http://127.0.0.1:${opened.port}/share/${opened.shareId}/desk_context`);
    assert.equal(response.status, 413);
  } finally { await share.close(); }
});
