import { challengeSchema, readySchema, randomHex, signPair, verifyPair, type Pairing } from './pairing-protocol';

type Callbacks = {
  status: (state: 'waiting' | 'connected' | 'blocked', detail: string) => void;
  disconnected: () => void;
};
/** Per-tab memory only: neither documents nor browser storage contain credentials. */
export class BrowserConnection {
  private pair: Pairing | null = null;
  private socket: WebSocket | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private generation = 0;
  private attempt = 0;
  constructor(private callbacks: Callbacks) {}
  hasPairing() { return this.pair !== null; }
  connect(token: string, port: string, request: (ws: WebSocket, event: MessageEvent) => void, replace = false) {
    if (replace) this.pair = null;
    const generation = ++this.generation;
    clearTimeout(this.timer); this.socket?.close();
    this.callbacks.disconnected();
    this.callbacks.status('waiting', 'サーバーの復帰と接続確認を待っています。机の編集・保存は続けられます。');
    const paired = this.pair;
    const clientNonce = randomHex();
    let serverNonce = '', candidate = paired, authenticated = false, blocked = false;
    const ws = new WebSocket(`ws://127.0.0.1:${port}/bridge${paired ? '?resume=1' : `?token=${encodeURIComponent(token)}`}`);
    this.socket = ws;
    const current = () => generation === this.generation;
    const block = () => {
      if (!current()) return;
      blocked = true; ws.close();
      this.callbacks.status('blocked', '接続相手を確認できないため、自動再接続を停止しました。机を保存するか、接続欄から手動で再接続してください。');
    };
    const deadline = setTimeout(() => ws.close(), 9000);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'hello', pairId: paired?.pairId ?? null, nonce: clientNonce }));
    let chain = Promise.resolve();
    ws.onmessage = event => {
      chain = chain.then(async () => {
        if (!current() || ws.readyState !== WebSocket.OPEN) return;
        if (authenticated) { request(ws, event); return; }
        const value = JSON.parse(String(event.data));
        if (value.type === 'challenge') {
          const challenge = challengeSchema.parse(value);
          if (serverNonce || (paired && challenge.pairing)) { block(); return; }
          candidate = paired ?? challenge.pairing ?? null; serverNonce = challenge.nonce;
          if (!candidate || !await verifyPair(candidate, 'server', clientNonce, serverNonce, challenge.proof)) { block(); return; }
          const proof = await signPair(candidate, 'client', clientNonce, serverNonce);
          if (!current() || ws.readyState !== WebSocket.OPEN) return;
          ws.send(JSON.stringify({ type: 'proof', proof }));
        } else {
          const ready = readySchema.parse(value);
          if (!candidate || !serverNonce || !await verifyPair(candidate, 'ready', clientNonce, serverNonce, ready.proof)) { block(); return; }
          if (!current() || ws.readyState !== WebSocket.OPEN) return;
          this.pair = candidate; authenticated = true; this.attempt = 0;
          clearTimeout(deadline); this.callbacks.status('connected', '');
        }
      }).catch(block);
    };
    ws.onerror = () => {}; // Ordinary downtime is quiet; close schedules the retry.
    ws.onclose = event => {
      clearTimeout(deadline);
      if (!current() || blocked) return;
      this.callbacks.disconnected();
      if (event.code === 4003) { block(); return; }
      this.callbacks.status('waiting', 'サーバーの復帰と接続確認を待っています。机の編集・保存は続けられます。');
      const delay = [250, 1000, 2000, 5000][Math.min(this.attempt++, 3)];
      this.timer = setTimeout(() => this.connect(token, port, request), delay);
    };
  }
}
