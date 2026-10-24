import {callTestTool} from './mcp-call';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { WebSocket } from 'ws';
import { pairPeer } from './pairing-peer';
import { randomHex } from '../src/pairing-protocol';

test('release rejects legacy/pending/uncertain peers and isolates stale handshakes and socket close', { timeout: 20_000 }, async () => {
  const listener = createServer(); listener.listen(0, '127.0.0.1'); await once(listener, 'listening');
  const port = (listener.address() as { port: number }).port;
  await new Promise<void>(resolve => listener.close(() => resolve()));
  const token = 'release-test-01234567890123456789', origin = `http://127.0.0.1:${port}`;
  const base = origin.replace('http:', 'ws:') + '/bridge';
  const transport = new StdioClientTransport({ command: process.execPath, args: ['--import', 'tsx', 'src/server.ts'], cwd: process.cwd(),
    env: { ...Object.fromEntries(Object.entries(process.env).filter((pair): pair is [string, string] => pair[1] !== undefined)), TABLETOP_PORT: String(port), TABLETOP_TOKEN: token }, stderr: 'pipe' });
  const client = new Client({ name: 'release-test', version: '1.0.0' });
  const sockets: WebSocket[] = [];
  const call = (name: string, args: Record<string, unknown> = {}) => callTestTool(client, { name, arguments: args });
  const value = (result: Awaited<ReturnType<typeof call>>) => JSON.parse((result.content as { text: string }[])[0].text);
  try {
    await client.connect(transport);
    await call('desk_pairing_open', { confirm: true });
    const peer = await pairPeer(base + '?token=' + token, origin); sockets.push(peer.ws);
    const legacy = await call('desk_release', { confirm: true });
    assert.equal(legacy.isError, true); assert.match(JSON.stringify(legacy), /does not support/);
    assert.equal(peer.ws.readyState, WebSocket.OPEN);
    peer.ws.send(JSON.stringify({ type: 'capabilities', release: true }));
    // A pending application request must finish before release can start.
    const requestMessage = once(peer.ws, 'message');
    const summary = call('desk_summary');
    const request = JSON.parse(String((await requestMessage)[0]));
    assert.match(JSON.stringify(await call('desk_release', { confirm: true })), /requests are pending/);
    peer.ws.send(JSON.stringify({ id: request.id, result: { count: 7 } }));
    assert.equal(value(await summary).count, 7);
    // A wrong ACK cannot open acceptance. The pairing remains available for inspection.
    peer.ws.once('message', () => peer.ws.send(JSON.stringify({ type: 'release_ack', id: 'wrong' })));
    const timedOut = await call('desk_release', { confirm: true });
    assert.equal(timedOut.isError, true); assert.match(JSON.stringify(timedOut), /timed out/);
    assert.equal(value(await call('desk_connection_info')).pairingState, 'paired');
    assert.equal(value(await call('desk_pairing_info')).pairing.pairId, peer.pairing.pairId);
    // An in-flight resume handshake is invalidated before acceptance opens.
    const stale = new WebSocket(base + '?resume=1', { origin }); sockets.push(stale);
    await once(stale, 'open'); const challenged = once(stale, 'message');
    stale.send(JSON.stringify({ type: 'hello', pairId: peer.pairing.pairId, nonce: randomHex() }));
    await challenged;
    const staleClosed = once(stale, 'close');
    peer.ws.once('message', data => {
      const notice = JSON.parse(data.toString());
      // Delay the old close handshake until a replacement has a pending request.
      peer.ws.pause();
      peer.ws.send(JSON.stringify({ type: 'release_ack', id: notice.id }));
    });
    const released = await call('desk_release', { confirm: true });
    assert.notEqual(released.isError, true);
    assert.equal(value(released).waitingFor, 'new-pairing');
    await staleClosed;
    assert.equal((await call('desk_pairing_info',{deskId:peer.deskId})).isError,true);
    const next = await pairPeer(base + '?token=' + token, origin); sockets.push(next.ws);
    assert.notEqual(next.pairing.pairId, peer.pairing.pairId);
    const incoming = once(next.ws, 'message'); const nextSummary = call('desk_summary');
    const nextRequest = JSON.parse(String((await incoming)[0]));
    const oldClosed = once(peer.ws, 'close'); peer.ws.resume(); await oldClosed;
    next.ws.send(JSON.stringify({ id: nextRequest.id, result: { count: 11 } }));
    assert.equal(value(await nextSummary).count, 11);
    // The invalidated old identity cannot reclaim the new slot.
    const old = new WebSocket(base + '?resume=1', { origin }); sockets.push(old);
    await once(old, 'open'); const rejected = once(old, 'close');
    old.send(JSON.stringify({ type: 'hello', pairId: peer.pairing.pairId, nonce: randomHex() }));
    assert.equal((await rejected)[0], 4003);
  } finally {
    for (const ws of sockets) ws.terminate();
    await client.close(); await transport.close();
  }
});
