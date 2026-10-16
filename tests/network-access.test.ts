import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { isPrivateIpv4, NetworkAccess } from '../src/network-access';

test('LAN policy allows only current private IPv4 addresses when explicitly enabled', async () => {
  for (const address of ['10.0.0.1', '172.16.0.1', '172.31.255.254', '192.168.1.2']) assert.equal(isPrivateIpv4(address), true);
  for (const address of ['127.0.0.1', '0.0.0.0', '8.8.8.8', '172.32.0.1', '192.168.1.999', '010.0.0.1', 'example.com', '::1']) assert.equal(isPrivateIpv4(address), false);
  const server = createServer();
  const network = new NetworkAccess(server, 4317, () => ['192.168.1.2']);
  assert.equal(network.allowsHost('192.168.1.2:4317'), false);
  assert.equal(network.allowsOrigin('http://192.168.1.2:4317'), false);
  assert.equal(network.allowsHost('127.0.0.1:4317'), true);
  for (const address of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) assert.equal(network.allowsPeer(address), true);
  for (const address of ['192.168.1.2', '127.0.0.2', undefined]) assert.equal(network.allowsPeer(address), false);
  assert.equal(network.allowsOrigin('http://localhost:5173'), true);
  for (const host of ['localhost:4318', 'localhost.evil:4317', 'evil.test:4317', '127.0.0.1:4317@evil.test']) assert.equal(network.allowsHost(host), false);
  const empty = new NetworkAccess(server, 4317, () => []);
  await assert.rejects(empty.setLan(true), /No private IPv4/);
  assert.equal(empty.info().lanEnabled, false);
});

test('same-port listener changes preserve upgraded browser sockets; tests never bind wildcard', async () => {
  const server = createServer((_req, res) => res.end('ok'));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = (server.address() as { port: number }).port;
  await new Promise<void>(resolve => server.close(() => resolve()));
  const requested: string[] = [];
  const network = new NetworkAccess(server, port, () => ['192.168.1.2'], host => { requested.push(host); return '127.0.0.1'; });
  const wss = new WebSocketServer({ server });
  wss.on('connection', ws => ws.on('message', data => ws.send(data)));
  await network.listen();
  const ws = new WebSocket(`ws://127.0.0.1:${port}`); await once(ws, 'open');
  try {
    for (const enabled of [true, false, true, false]) {
      const changed = network.setLan(enabled);
      await assert.rejects(network.setLan(enabled), /in progress/);
      assert.equal((await changed).lanEnabled, enabled);
      assert.equal(network.allowsPeer('192.168.1.2'), enabled);
      assert.equal(network.allowsHost(`192.168.1.2:${port}`), enabled);
      assert.equal(network.allowsOrigin(`http://192.168.1.2:${port}`), enabled);
      assert.equal(network.allowsHost(`192.168.1.3:${port}`), false);
      assert.equal((server.address() as { port: number }).port, port);
      assert.equal(await (await fetch(`http://127.0.0.1:${port}/`, { headers: { Connection: 'close' } })).text(), 'ok');
      const reply = once(ws, 'message'); ws.send('still-paired');
      assert.equal(String((await reply)[0]), 'still-paired');
    }
    assert.deepEqual(requested, ['127.0.0.1', '0.0.0.0', '127.0.0.1', '0.0.0.0', '127.0.0.1']);
  } finally {
    const closed = once(ws, 'close'); ws.close(); await closed;
    wss.close(); await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
