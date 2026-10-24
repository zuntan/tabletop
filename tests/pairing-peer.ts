import { once } from 'node:events';
import { WebSocket } from 'ws';
import { challengeSchema, readySchema, randomHex, signPair, verifyPair, type Pairing,connectionDeskId } from '../src/pairing-protocol';

export async function pairPeer(url: string, origin: string, existing?: Pairing) {
  const ws = new WebSocket(url, { origin });
  await once(ws, 'open');
  const nonce = randomHex();
  const challengeMessage = once(ws, 'message');
  ws.send(JSON.stringify({ type: 'hello', pairId: existing?.pairId ?? null, nonce }));
  const challenge = challengeSchema.parse(JSON.parse(String((await challengeMessage)[0])));
  const pairing = existing ?? challenge.pairing!;
  if (!await verifyPair(pairing, 'server', nonce, challenge.nonce, challenge.proof)) throw new Error('Bad server proof');
  const readyMessage = once(ws, 'message');
  ws.send(JSON.stringify({ type: 'proof', proof: await signPair(pairing, 'client', nonce, challenge.nonce) }));
  const ready = readySchema.parse(JSON.parse(String((await readyMessage)[0])));
  if (!await verifyPair(pairing, 'ready', nonce, challenge.nonce, ready.proof)) throw new Error('Bad ready proof');
  return { ws, pairing,deskId:connectionDeskId(pairing.pairId) };
}
