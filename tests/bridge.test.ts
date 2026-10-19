import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { WebSocket } from 'ws';
import { Desk, dispatch } from '../src/model.js';
import { pairPeer } from './pairing-peer';

async function freePort() {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = (server.address() as { port: number }).port;
  await new Promise<void>(resolve => server.close(() => resolve())); return port;
}
function rejectConnection(url: string, origin: string, status: number) {
  return new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(url, { origin });
    ws.on('unexpected-response', (_req, response) => {
      response.resume(); ws.terminate();
      try { assert.equal(response.statusCode, status); resolve(); } catch (error) { reject(error); }
    });
    ws.on('error', () => {});
    ws.on('open', () => { ws.close(); reject(new Error('Unauthorized connection accepted')); });
  });
}
test('real stdio MCP server relays tools to a browser state and rejects unauthorized sockets', { timeout: 20_000 }, async () => {
  const port = await freePort(), token = 'test-token-for-tabletop-0123456789';
  const origin = `http://127.0.0.1:${port}`;
  const transport = new StdioClientTransport({
    command: process.execPath, args: ['--import', 'tsx', 'src/server.ts'], cwd: process.cwd(),
    env: { ...Object.fromEntries(Object.entries(process.env).filter((pair): pair is [string, string] => pair[1] !== undefined)), TABLETOP_PORT: String(port), TABLETOP_TOKEN: token }, stderr: 'pipe',
  });
  const client = new Client({ name: 'tabletop-test', version: '1.0.0' });
  let ws: WebSocket | undefined;
  try {
    await client.connect(transport);
    const tools = await client.listTools(); assert.equal(tools.tools.length, 35);
    assert.equal(tools.tools.find(tool => tool.name === 'desk_lock')?.annotations?.readOnlyHint, false);
    assert.equal(tools.tools.find(tool => tool.name === 'desk_fit')?.annotations?.readOnlyHint, false);
    assert.equal(tools.tools.find(tool => tool.name === 'desk_camera_get')?.annotations?.readOnlyHint, true);
    assert.equal(tools.tools.find(tool => tool.name === 'desk_camera_move')?.annotations?.readOnlyHint, false);
    assert.notEqual((await client.callTool({ name: 'desk_pairing_open', arguments: { confirm: true } })).isError, true);
    for (const name of ['desk_context', 'desk_asset_read', 'desk_asset_import', 'desk_connection_info', 'desk_point', 'desk_save', 'desk_load', 'desk_network_set']) assert.ok(tools.tools.some(tool => tool.name === name));
    assert.equal(tools.tools.find(tool => tool.name === 'desk_point')?.annotations?.readOnlyHint, false);
    assert.equal((await client.callTool({ name: 'desk_summary' })).isError, true);
    assert.equal((await fetch(origin)).status, 200);
    const response = await fetch(origin);
    assert.ok(response.headers.get('content-security-policy')?.includes("object-src 'none'"));
    await rejectConnection(`ws://127.0.0.1:${port}/bridge?token=bad`, origin, 403);
    await rejectConnection(`ws://127.0.0.1:${port}/bridge?token=${token}`, 'https://evil.example', 403);
    ws = (await pairPeer(`ws://127.0.0.1:${port}/bridge?token=${token}`, origin)).ws;
    const desk = new Desk();
    let legacy = false, legacyName = false, legacyBackground = false, mutationRequests = 0;
    ws.on('message', data => {
      const message = JSON.parse(data.toString());
      try {
        if (message.request.method === 'execute') mutationRequests++;
        const result = dispatch(desk, message.request) as Record<string, unknown>;
        if (legacy && message.request.method === 'settings') delete result.grid;
        if (legacyName && message.request.method === 'settings') delete result.name;
        if (legacyBackground && message.request.method === 'settings') delete result.background;
        ws!.send(JSON.stringify({ id: message.id, result }));
      }
      catch (error) { ws!.send(JSON.stringify({ id: message.id, error: String(error) })); }
    });
    await rejectConnection(`ws://127.0.0.1:${port}/bridge?token=${token}`, origin, 409);
    async function call(name: string, args: Record<string, unknown> = {}) {
      const result = await client.callTool({ name, arguments: name === 'desk_execute' ? { snap: 'exact', ...args } : args });
      assert.notEqual(result.isError, true, JSON.stringify(result));
      const content = result.content as { type: string; text: string }[];
      return JSON.parse(content[0].text);
    }
    assert.equal((await call('desk_summary')).revision, 0);
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'ai-rect', type: 'rect', x: 10 } }] });
    assert.equal(desk.get('ai-rect').x, 10);
    desk.select(['ai-rect']);
    assert.deepEqual((await call('desk_selection')).ids, ['ai-rect']);
    await call('desk_execute', { expectedRevision: 1, operations: [{ kind: 'update', id: 'ai-rect', patch: { x: 80 } }] });
    desk.undo('human');
    const changes = await call('desk_changes', { sinceRevision: 1 });
    assert.equal(changes.currentRevision, 3);
    assert.deepEqual(changes.changes.map((c: { operation: string }) => c.operation), ['batch', 'undo']);
    assert.equal((await call('desk_get', { id: 'ai-rect' })).x, 10);
    await call('desk_redo'); assert.equal(desk.get('ai-rect').x, 80);
    assert.equal((await client.callTool({ name: 'desk_execute', arguments: { expectedRevision: 0, operations: [{ kind: 'delete', id: 'ai-rect' }] } })).isError, true);
    legacy = true;
    const sent = mutationRequests, revision = desk.revision;
    const blocked = await client.callTool({ name: 'desk_execute', arguments: { operations: [{ kind: 'update', id: 'ai-rect', patch: { x: 35 } }] } });
    assert.equal(blocked.isError, true); assert.match(JSON.stringify(blocked.content), /Save the current desk/);
    const blockedAsset = await client.callTool({ name: 'desk_asset_import', arguments: { id: 'old-ui-image', source: { svg: '<svg xmlns="http://www.w3.org/2000/svg"/>' } } });
    assert.equal(blockedAsset.isError, true);
    assert.equal(mutationRequests, sent); assert.equal(desk.revision, revision);
    assert.equal((await call('desk_settings')).grid, undefined); // Read-only access remains available before upgrade.
    assert.equal((await call('desk_summary')).count, 1);
    legacy = false; legacyName = true;
    const blockedName = await client.callTool({ name: 'desk_execute', arguments: { operations: [{ kind: 'desk_rename', name: 'not sent' }] } });
    assert.equal(blockedName.isError, true); assert.match(JSON.stringify(blockedName.content), /does not support desk names/);
    assert.equal(mutationRequests, sent); assert.equal(desk.revision, revision);
    legacyName = false;
    legacyBackground = true;
    const blockedBackground = await client.callTool({ name: 'desk_execute', arguments: { operations: [{ kind: 'background_update', patch: { wallpaper: 'wood' } }] } });
    assert.equal(blockedBackground.isError, true); assert.match(JSON.stringify(blockedBackground.content), /does not support wallpapers/);
    assert.equal(mutationRequests, sent); assert.equal(desk.revision, revision);
    legacyBackground = false;
    await call('desk_execute', { operations: [{ kind: 'desk_rename', name: 'AI named desk' }] });
    assert.equal((await call('desk_summary')).name, 'AI named desk');
    ws.close(); await once(ws, 'close');
    assert.equal((await client.callTool({ name: 'desk_summary' })).isError, true);
  } finally { ws?.terminate(); await client.close(); await transport.close(); }
});
