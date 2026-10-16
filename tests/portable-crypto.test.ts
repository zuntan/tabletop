import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHmac, webcrypto } from 'node:crypto';
import { randomUuid, sha256Hex } from '../src/portable-crypto';
import { randomHex, signPair, verifyPair } from '../src/pairing-protocol';
import { Desk } from '../src/model';
import { encodeDeskFile, decodeDeskFile } from '../src/desk-file';

test('HTTP-compatible crypto preserves UUID, SHA-256, pairing proofs and desk archives without subtle', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto')!;
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: {
    getRandomValues: webcrypto.getRandomValues.bind(webcrypto),
  } });
  try {
    const ids = new Set(Array.from({ length: 100 }, randomUuid));
    assert.equal(ids.size, 100);
    for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.equal(sha256Hex(new TextEncoder().encode('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    const pair = { pairId: randomUuid(), token: randomHex(), secret: randomHex() };
    const client = randomHex(), server = randomHex();
    const transcript = JSON.stringify(['tabletop-pair-v1', 'server', pair.pairId, pair.token, client, server]);
    const proof = await signPair(pair, 'server', client, server);
    assert.equal(proof, createHmac('sha256', Buffer.from(pair.secret, 'hex')).update(transcript).digest('hex'));
    assert.equal(await verifyPair(pair, 'server', client, server, proof), true);
    assert.equal(await verifyPair(pair, 'client', client, server, proof), false);
    for (const position of [0, 31, 63]) {
      const changed = proof.slice(0, position) + (proof[position] === '0' ? '1' : '0') + proof.slice(position + 1);
      assert.equal(await verifyPair(pair, 'server', client, server, changed), false);
    }
    const desk = new Desk();
    desk.execute({ operations: [{ kind: 'add', object: { id: 'asset', type: 'svg', src: 'data:image/svg+xml;base64,PHN2Zy8+' } }] });
    const decoded = await decodeDeskFile(await encodeDeskFile(desk));
    assert.deepEqual(decoded.objects, desk.snapshot());
    assert.deepEqual(decoded.settings, desk.settingsSnapshot());
  } finally { Object.defineProperty(globalThis, 'crypto', original); }
});
