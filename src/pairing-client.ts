import { challengeSchema, readySchema, randomHex, signPair, verifyPair, type Pairing, connectionDeskId } from './pairing-protocol';

type Callbacks = {
  identity?: (deskId:string)=>void;
  status: (state: 'waiting' | 'connected' | 'blocked' | 'released', detail: string) => void;
  disconnected: () => void;
  beforeRelease?: () => void;
  handoff?: (url: string) => void;
  handoffError?: (error: string) => void;
};
/** Per-tab memory only: neither documents nor browser storage contain credentials. */
export class BrowserConnection {
  private pair: Pairing | null = null;
  private socket: WebSocket | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private generation = 0;
  private attempt = 0;
  private handoffRequested = false;
  private fileReady=false;
  private filePending=new Map<string,{resolve:(value:any)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
  private clearFiles(){this.fileReady=false;for(const p of this.filePending.values()){clearTimeout(p.timer);p.reject(new Error('接続が切れました。保存結果は未確定の場合があります。自動再実行はしません'));}this.filePending.clear();}
  fileRequest(request:unknown,timeoutMs=30_000):Promise<any>{
    if(!this.fileReady||this.socket?.readyState!==WebSocket.OPEN)return Promise.reject(new Error('通常SAVE／LOADには対応したMCP接続が必要です。未保存の机はダウンロードできます'));
    const id=crypto.randomUUID();return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.filePending.delete(id);reject(new Error('ファイル処理が時間切れになりました。結果を確認してから操作してください（自動再実行なし）'));},timeoutMs);
      this.filePending.set(id,{resolve,reject,timer});
      try{this.socket!.send(JSON.stringify({type:'file_request',id,request}));}catch(error){clearTimeout(timer);this.filePending.delete(id);reject(error);}
    });
  }
  clipboardRequest(token:string):Promise<unknown>{return this.fileRequest({method:'clipboard_lookup',token},1500);}
  constructor(private callbacks: Callbacks) {}
  hasPairing() { return this.pair !== null; }
  ringBell(ids:string[],note:{text:string;draftVersion:number}) {
    if(!this.pair||this.socket?.readyState!==WebSocket.OPEN)throw new Error('AIとの接続が必要です');
    this.socket.send(JSON.stringify({type:'bell_press',ids:ids.slice(0,200),...note}));
  }
  requestHandoff() {
    if (this.handoffRequested) return;
    if (!this.pair || this.socket?.readyState !== WebSocket.OPEN) throw new Error('AIとの接続が必要です。');
    this.handoffRequested = true;
    this.socket.send(JSON.stringify({ type: 'handoff_request' }));
  }
  connect(token: string, port: string, request: (ws: WebSocket, event: MessageEvent) => void, replace = false, host = '127.0.0.1') {
    if (replace) this.pair = null;
    this.handoffRequested = false;
    const generation = ++this.generation;
    clearTimeout(this.timer); this.socket?.close();
    this.clearFiles();this.callbacks.disconnected();
    this.callbacks.status('waiting', 'サーバーの復帰と接続確認を待っています。机の編集・保存は続けられます。');
    const paired = this.pair;
    const clientNonce = randomHex();
    let serverNonce = '', candidate = paired, authenticated = false, blocked = false;
    const ws = new WebSocket(`ws://${host}:${port}/bridge${paired ? '?resume=1' : `?token=${encodeURIComponent(token)}`}`);
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
        const value = JSON.parse(String(event.data));
        if (authenticated) {
          if(value.type==='file_ready'){this.fileReady=true;return;}
          if(value.type==='file_result'){
            const pending=this.filePending.get(value.id);if(!pending)return;
            clearTimeout(pending.timer);this.filePending.delete(value.id);
            if(typeof value.error==='string')pending.reject(new Error(value.error));else pending.resolve(value.result);return;
          }
          if (value.type === 'handoff_error') {
            this.handoffRequested = false;
            this.callbacks.handoffError?.(String(value.error)); return;
          }
          if (value.type === 'release' && typeof value.id === 'string') {
            const humanHandoff = this.handoffRequested && typeof value.handoffUrl === 'string';
            try { if (!humanHandoff) this.callbacks.beforeRelease?.(); }
            catch (error) {
              ws.send(JSON.stringify({ type: 'release_rejected', id: value.id, error: error instanceof Error ? error.message : String(error) }));
              return;
            }
            // Stop retries before acknowledging; the server opens acceptance only after this ACK.
            ++this.generation; clearTimeout(this.timer); clearTimeout(deadline);
            this.pair = null; this.socket = null;
            this.clearFiles();this.callbacks.disconnected();
            this.callbacks.status('released', 'AIとの接続を解放しました。自動再接続は停止しています。机の編集・保存は続けられます。再接続する場合は接続欄から手動で接続してください。');
            ws.send(JSON.stringify({ type: 'release_ack', id: value.id }));
            ws.close(4003, 'Desk released');
            this.handoffRequested = false;
            if (humanHandoff) this.callbacks.handoff?.(value.handoffUrl);
          } else request(ws, event);
          return;
        }
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
          this.callbacks.identity?.(connectionDeskId(candidate.pairId));
          ws.send(JSON.stringify({ type: 'capabilities', release: true, bell:true, toast:true, fileOperations:true }));
          clearTimeout(deadline); this.callbacks.status('connected', '');
        }
      }).catch(block);
    };
    ws.onerror = () => {}; // Ordinary downtime is quiet; close schedules the retry.
    ws.onclose = event => {
      clearTimeout(deadline);
      if (!current() || blocked) return;
      this.clearFiles();this.callbacks.disconnected();
      if (event.code === 4003) { block(); return; }
      this.callbacks.status('waiting', 'サーバーの復帰と接続確認を待っています。机の編集・保存は続けられます。');
      const delay = [250, 1000, 2000, 5000][Math.min(this.attempt++, 3)];
      this.timer = setTimeout(() => this.connect(token, port, request, false, host), delay);
    };
  }
}
