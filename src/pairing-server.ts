import { WebSocket } from 'ws';
import { pairingSchema, helloSchema, proofSchema, randomHex, signPair, verifyPair, type Pairing } from './pairing-protocol.js';

/** Ephemeral pairing state. Unauthenticated sockets never own the desk slot. */
export class PairingGate {
  private pairing: Pairing | null = null;
  private bootstrap = false;
  private epoch = 0;
  private waiting = new Set<WebSocket>();
  constructor(private connected: () => boolean) {}
  get canBootstrap() { return this.bootstrap && !this.pairing; }
  get pendingCount() { return this.waiting.size; }
  get acceptanceEpoch() { return this.epoch; }
  info() { return this.pairing ? { ...this.pairing } : null; }
  private change() {
    this.epoch++;
    for (const ws of this.waiting) ws.close(4000, 'Pairing configuration changed');
  }
  suspend() { this.change(); this.bootstrap = false; }
  open() {
    if (this.connected()) throw new Error('Disconnect the current desk before replacing its pairing');
    this.change(); this.pairing = null; this.bootstrap = true;
    return { waitingFor: 'new-pairing' };
  }
  restore(input: unknown) {
    const pair = pairingSchema.parse(input);
    if (this.connected()) throw new Error('A desk is already connected; do not replace it');
    if (this.pairing && JSON.stringify(this.pairing) !== JSON.stringify(pair)) throw new Error('Another pairing is armed; explicit manual replacement required');
    this.change(); this.pairing = pair; this.bootstrap = false;
    return { waitingFor: 'paired-desk', pairId: pair.pairId };
  }
  accept(ws: WebSocket, initial: boolean, ready: () => void, firstMessage?: import('ws').RawData) {
    if (this.waiting.size >= 8) { ws.close(4000, 'Retry later'); return; }
    this.waiting.add(ws);
    const epoch = this.epoch;
    let candidate: Pairing | null = null, clientNonce = '', serverNonce = '', stage = 'hello';
    let active = true, processing = false;
    const timer = setTimeout(() => ws.terminate(), 8000);
    const cleanup = () => { active = false; clearTimeout(timer); this.waiting.delete(ws); ws.off('message', message); };
    const reject = (reason: string) => {
      active = false;
      console.error(`[Tabletop] ${new Date().toISOString()} Pairing rejected: ${reason}`);
      ws.close(4003, reason);
    };
    const valid = () => active && epoch === this.epoch && ws.readyState === WebSocket.OPEN;
    const message = async (data: import('ws').RawData) => {
      const size = Array.isArray(data) ? data.reduce((sum, part) => sum + part.byteLength, 0) : data.byteLength;
      if (processing || size > 4096) { reject('Invalid pairing message'); return; }
      processing = true;
      try {
        if (!valid()) { ws.close(4000, 'Retry later'); return; }
        const value = JSON.parse(data.toString());
        if (stage === 'hello') {
          const hello = helloSchema.parse(value);
          if (initial) {
            if (!this.canBootstrap || hello.pairId !== null) { reject('Manual pairing required'); return; }
            candidate = { pairId: crypto.randomUUID(), token: randomHex(), secret: randomHex() };
          } else {
            if (!this.pairing) { active = false; ws.close(4000, 'Waiting for AI recovery setup'); return; }
            if (hello.pairId !== this.pairing.pairId) { reject('Pairing mismatch'); return; }
            candidate = this.pairing;
          }
          clientNonce = hello.nonce; serverNonce = randomHex();
          const proof = await signPair(candidate, 'server', clientNonce, serverNonce);
          if (!valid()) return;
          stage = 'proof';
          ws.send(JSON.stringify({ type: 'challenge', nonce: serverNonce, proof, ...(initial ? { pairing: candidate } : {}) }));
        } else if (stage === 'proof' && candidate) {
          const response = proofSchema.parse(value);
          if (!await verifyPair(candidate, 'client', clientNonce, serverNonce, response.proof)) { reject('Pairing proof failed'); return; }
          const proof = await signPair(candidate, 'ready', clientNonce, serverNonce);
          if (!valid()) return;
          if (this.connected()) { active = false; ws.close(4000, 'Desk already connected'); return; }
          if (initial && !this.canBootstrap) { reject('Pairing already claimed'); return; }
          this.pairing = candidate; this.bootstrap = false;
          cleanup(); ws.send(JSON.stringify({ type: 'ready', proof })); ready();
          console.error(`[Tabletop] ${new Date().toISOString()} Paired browser connected`);
        } else reject('Invalid pairing state');
      } catch { reject('Invalid pairing message'); }
      finally { processing = false; }
    };
    ws.on('message', message); ws.once('close', cleanup);
    if(firstMessage!==undefined)void message(firstMessage); ws.on('error', () => {});
  }
}
