import { z } from 'zod';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

const hex = z.string().regex(/^[0-9a-f]{64}$/);
export const pairingSchema = z.object({ pairId: z.string().uuid(), token: hex, secret: hex }).strict();
export type Pairing = z.infer<typeof pairingSchema>;
export const helloSchema = z.object({ type: z.literal('hello'), pairId: z.string().uuid().nullable(), nonce: hex }).strict();
export const challengeSchema = z.object({ type: z.literal('challenge'), nonce: hex, proof: hex, pairing: pairingSchema.optional() }).strict();
export const proofSchema = z.object({ type: z.literal('proof'), proof: hex }).strict();
export const readySchema = z.object({ type: z.literal('ready'), proof: hex }).strict();
export function randomHex() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), value => value.toString(16).padStart(2, '0')).join('');
}
function bytes(hex: string) { return Uint8Array.from(hex.match(/../g)!, value => parseInt(value, 16)); }
async function key(pair: Pairing) {
  return crypto.subtle.importKey('raw', bytes(pair.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
function transcript(pair: Pairing, role: string, client: string, server: string) {
  return new TextEncoder().encode(JSON.stringify(['tabletop-pair-v1', role, pair.pairId, pair.token, client, server]));
}
export async function signPair(pair: Pairing, role: string, client: string, server: string) {
  return bytesToHex(hmac(sha256, bytes(pair.secret), transcript(pair, role, client, server)));
}
export async function verifyPair(pair: Pairing, role: string, client: string, server: string, proof: string) {
  if (!/^[0-9a-f]{64}$/.test(proof)) return false;
  if (crypto.subtle) return crypto.subtle.verify('HMAC', await key(pair), bytes(proof), transcript(pair, role, client, server));
  const expected = hmac(sha256, bytes(pair.secret), transcript(pair, role, client, server));
  const actual = bytes(proof);
  // Fixed-length, no early exit; JS engines cannot guarantee constant-time execution.
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected[i]! ^ actual[i]!;
  return difference === 0;
}
