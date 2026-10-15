import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { WebSocket, WebSocketServer } from 'ws';
import { PairingGate } from '../src/pairing-server';
import { randomHex, signPair, verifyPair, type Pairing } from '../src/pairing-protocol';
import { pairPeer } from './pairing-peer';

const pair = (): Pairing => ({ pairId: crypto.randomUUID(), token: randomHex(), secret: randomHex() });
test('proofs bind both nonces, pair identity, token and direction; malformed or replayed proofs fail', async () => {
  const p = pair(), client = randomHex(), server = randomHex();
  const proof = await signPair(p, 'server', client, server);
  assert.ok(await verifyPair(p, 'server', client, server, proof));
  for (const candidate of [{ ...p, pairId: crypto.randomUUID() }, { ...p, token: randomHex() }, { ...p, secret: randomHex() }])
    assert.equal(await verifyPair(candidate, 'server', client, server, proof), false);
  assert.equal(await verifyPair(p, 'client', client, server, proof), false);
  assert.equal(await verifyPair(p, 'server', randomHex(), server, proof), false);
  assert.equal(await verifyPair(p, 'server', client, randomHex(), proof), false);
  assert.equal(await verifyPair(p, 'server', client, server, 'x'), false);
});

test('only a fully proven expected peer owns the slot; replacement is explicit', async () => {
  let connected = false;
  const gate = new PairingGate(() => connected);
  const wss = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await once(wss, 'listening');
  const address = wss.address() as { port: number };
  const origin = `http://127.0.0.1:${address.port}`, base = origin.replace('http:', 'ws:');
  wss.on('connection', (ws, req) => gate.accept(ws, req.url === '/initial', () => {
    connected = true; ws.on('close', () => { connected = false; });
  }));
  async function rejected(path: string, value: unknown, expected: number) {
    const ws = new WebSocket(base + path);
    await once(ws, 'open'); const close = once(ws, 'close');
    ws.send(JSON.stringify(value));
    const [code] = await close;
    assert.equal(code, expected); assert.equal(connected, false);
  }
  try {
    await rejected('/resume', { type: 'hello', pairId: crypto.randomUUID(), nonce: randomHex() }, 4000);
    await rejected('/initial', { type: 'hello', pairId: null, nonce: randomHex() }, 4003);
    const expected = pair(); gate.restore(expected);
    const copy = gate.info()!; copy.secret = randomHex();
    assert.equal(gate.info()!.secret, expected.secret);
    assert.throws(() => gate.restore(pair()), /Another pairing/);
    await rejected('/resume', { type: 'hello', pairId: crypto.randomUUID(), nonce: randomHex() }, 4003);
    await rejected('/resume', { type: 'not-a-desk' }, 4003);
    // An unauthenticated peer cannot claim the active slot, even with a known pair ID.
    const impostor = new WebSocket(base + '/resume'); await once(impostor, 'open');
    const challenge = once(impostor, 'message');
    impostor.send(JSON.stringify({ type: 'hello', pairId: expected.pairId, nonce: randomHex() }));
    await challenge; assert.equal(connected, false);
    const denied = once(impostor, 'close'); impostor.send(JSON.stringify({ type: 'proof', proof: randomHex() }));
    assert.equal((await denied)[0], 4003);
    const peer = await pairPeer(base + '/resume', origin, expected);
    assert.equal(connected, true);
    assert.throws(() => gate.open(), /Disconnect/);
    assert.throws(() => gate.restore(expected), /already connected/);
    const closed = once(peer.ws, 'close'); peer.ws.close(); await closed;
    await new Promise(resolve => setImmediate(resolve));
    gate.open(); assert.equal(gate.info(), null);
    const initial = await pairPeer(base + '/initial', origin);
    assert.equal(gate.info()!.pairId, initial.pairing.pairId);
    const finalClose = once(initial.ws, 'close'); initial.ws.close(); await finalClose;
  } finally {
    for (const ws of wss.clients) ws.terminate();
    await new Promise<void>(resolve => wss.close(() => resolve()));
  }
});
