import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { mcpBatchSchema as batchSchema, type Request } from './model.js';
import { gridSettingsSchema } from './grid-settings.js';
import { registerAssetTools } from './asset-tools.js';
import { registerDeskFileTools } from './desk-file-tools.js';
import { isStaticPathInside } from './static-path.js';
import { PairingGate } from './pairing-server.js';
import { registerPairingTools } from './pairing-tools.js';
import { acknowledgeRelease } from './desk-release.js';

const port = Number(process.env.TABLETOP_PORT ?? 4317);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid TABLETOP_PORT');
const tokenFromEnv = process.env.TABLETOP_TOKEN !== undefined;
const token = process.env.TABLETOP_TOKEN ?? randomBytes(32).toString('hex');
const baseUrl = `http://127.0.0.1:${port}/`;
const connectionUrl = tokenFromEnv ? baseUrl : `${baseUrl}#token=${encodeURIComponent(token)}&port=${port}`;
if (token.length < 24) throw new Error('TABLETOP_TOKEN must be at least 24 characters');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const http = createServer(async (req, res) => {
  const host = req.headers.host;
  if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) { res.writeHead(403).end(); return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', `http://${host}`).pathname);
    const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!isStaticPathInside(root, path)) { res.writeHead(403).end(); return; }
    const body = await readFile(path);
    res.writeHead(200, {
      'Content-Type': mime[extname(path)] ?? 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: http:; frame-src https: http:; connect-src 'self' ws://127.0.0.1:* ws://localhost:*; object-src 'none'; base-uri 'none'",
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Run npm run build first.'); }
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 24_000_000 });
let browser: WebSocket | null = null;
let releasing = false;
const releaseCapable = new WeakSet<WebSocket>();
const gate = new PairingGate(() => browser !== null || releasing);
const pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();

http.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
  const origins = [`http://127.0.0.1:${port}`, `http://localhost:${port}`, 'http://127.0.0.1:5173', 'http://localhost:5173'];
  const resume = url.searchParams.get('resume') === '1';
  if (url.pathname !== '/bridge' || (!resume && url.searchParams.get('token') !== token) ||
      !origins.includes(req.headers.origin ?? '') ||
      ![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host ?? '')) {
    socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); socket.destroy(); return;
  }
  if (browser && !resume) { socket.write('HTTP/1.1 409 Conflict\r\nConnection: close\r\n\r\n'); socket.destroy(); return; }
  if (releasing || (!resume && !gate.canBootstrap) || gate.pendingCount >= 8) { socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n'); socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
});
function attachBrowser(ws: WebSocket) {
  browser = ws;

  ws.on('message', data => {
    try {
      const message = JSON.parse(data.toString());
      if (browser !== ws) return;
      if (message.type === 'capabilities' && message.release === true) { releaseCapable.add(ws); return; }
      const item = pending.get(message.id);
      if (!item) return;
      clearTimeout(item.timer); pending.delete(message.id);
      if (typeof message.error === 'string') item.reject(new Error(message.error));
      else item.resolve(message.result);
    } catch { ws.close(1007, 'Invalid response'); }
  });
  ws.on('error', error => console.error('[Tabletop] WebSocket:', error.message));
  ws.on('close', code => {
    console.error(`[Tabletop] ${new Date().toISOString()} Browser closed code=${code} pending=${pending.size}`);
    if (browser !== ws) return;
    browser = null;
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error('Browser disconnected; operation outcome may be unknown. Inspect revision before retrying.')); }
    pending.clear();
  });
}
wss.on('connection', (ws: WebSocket, req: import('node:http').IncomingMessage) => {
  gate.accept(ws, new URL(req.url!, baseUrl).searchParams.get('resume') !== '1', () => attachBrowser(ws));
});
function request(payload: Request): Promise<unknown> {
  return new Promise((resolveResult, reject) => {
    if (releasing) { reject(new Error('Desk release in progress; no request was sent.')); return; }
    if (!browser || browser.readyState !== WebSocket.OPEN) { reject(new Error('No browser connected. Open the Tabletop URL shown on stderr.')); return; }
    const id = randomUUID();
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Browser response timed out; outcome may be unknown. Inspect revision before retrying; no automatic replay occurs.'));
    }, 10_000);
    pending.set(id, { resolve: resolveResult, reject, timer });
    browser.send(JSON.stringify({ id, request: payload }), error => {
      if (!error) return;
      clearTimeout(timer); pending.delete(id); reject(error);
    });
  });
}
async function releaseDesk() {
  if (releasing) throw new Error('Desk release already in progress');
  const peer = browser;
  if (!peer || peer.readyState !== WebSocket.OPEN) throw new Error('No browser connected; use desk_pairing_open for new acceptance');
  if (!releaseCapable.has(peer)) throw new Error('Browser does not support intentional release. Save the desk before upgrading; no disconnect was sent.');
  if (pending.size) throw new Error('Browser requests are pending; wait for completion and inspect their outcomes before releasing.');
  releasing = true;
  gate.suspend();
  try {
    await acknowledgeRelease(peer);
    browser = null;
    peer.close(4003, 'Desk released');
    releasing = false;
    return { ...gate.open(), released: true };
  } finally { releasing = false; }
}
async function compatibleRequest(payload: Request): Promise<unknown> {
  if (payload.method === 'execute') {
    const peer = browser;
    const settings = z.object({ grid: gridSettingsSchema }).safeParse(await request({ method: 'settings' }));
    if (!settings.success) throw new Error('Browser does not support shared snap. Save the current desk before updating the browser; no edit was sent.');
    if (browser !== peer) throw new Error('Browser changed during compatibility check; refresh state before editing.');
  }
  return request(payload);
}
const mcp = new McpServer({ name: 'tabletop', version: '0.1.0' });
const tools = [
  ['desk_summary', 'Get session ID, revision, counts and undo/redo availability.', {}],
  ['desk_list', 'List objects in back-to-front order, excluding embedded image payloads.', {}],
  ['desk_get', 'Get one object including its image source, if any.', { id: z.string() }],
  ['desk_state', 'Get complete state; potentially large. Prefer desk_context for semantic overview without embedded assets.', {}],
  ['desk_context', 'Read one consistent snapshot: object metadata, selected IDs, connector endpoints/bindings, numbered pin series with members and next number, and paged shared history. No image payloads. New browsers include imageGeometry: world card/viewport/rendered rectangles and intrinsic CSS dimensions. Only use renderedRect when status is ready; loading can complete without revision changes. SVG/remote rectangles may be null. Also available via desk_list/desk_get. Use sessionId and revision to interpret changes; use history.nextRevision when history.hasMore. Detached endpoints have binding null. Read actual image/SVG contents with desk_asset_read.', { sinceRevision: z.number().int().nonnegative().default(0), limit: z.number().int().min(1).max(200).default(100) }],
  ['desk_settings', 'Get persisted shared grid settings (enabled, interval, origin), creation defaults and all pin series with IDs, names, shared appearance, counts and next number. Grid defaults to enabled, interval 24, origin (0,0). Shapes use top-left, labels bottom-center, free line endpoints their coordinates; explicit bindings take priority. Pins retain type label and label_add for compatibility. They are independent objects referenced by ID or seriesId plus number; repeated capped numbers require an ID.', {}],
  ['desk_selection', 'Get human selection IDs, independent aiPointing IDs and last known canvas pointer.', {}],
  ['desk_select', 'Set the human editing selection without changing revision or history. For AI questions or attention, use desk_point instead; edits target object IDs and do not require selection.', { ids: z.array(z.string()).max(2000) }],
  ['desk_point', 'Show green AI pointing frames for questions or attention, independently of the human blue selection. Explain the target in chat and clear with ids: [] when finished. Replaces the AI pointing set; no move/resize handles, document revision or Undo changes. Edit by object ID, not by pointing. Deleted targets and disconnected sessions clear pointing.', { ids: z.array(z.string()).max(2000) }],
  ['desk_changes', 'Get changes after a revision from this session; page via nextRevision.', { sinceRevision: z.number().int().nonnegative(), limit: z.number().int().min(1).max(200).default(100) }],
  ['desk_execute', 'Atomically edit objects and settings with shared Undo. add and series_add use current creation defaults for omitted appearance. defaults_update changes defaults; series_add/series_update define shared pin appearance and format (pin,text,rect,roundedRect,ellipse frames; default pin). New series use compact dimensions based on font size unless dimensions are explicit; updates never auto-resize. Pins keep type label and label_add for compatibility. label_add requires id,seriesId,x,y, accepts optional description, and assigns current maximum plus one, capped by format. Labels allow only x/y/description/reactions individual updates; delete/reorder are allowed. Every object may have reactions: a unique array of up to 18 symbols (👍,👎,❓,❗,⭕,❌,✔,👀,❤️,🤔,🆗,💡,🎉,🙏,📌,⏳,⚠️,😊). Legacy ✅, ○ and ✕ remain valid as aliases of ✔, ⭕ and ❌ respectively; do not include both forms of an alias. The UI preserves existing legacy symbols until explicitly removed. update patch.reactions replaces the set; [] clears it. Read current reactions and use expectedRevision to avoid overwriting concurrent changes. Reactions attach as badges, share Undo, and do not change geometry or bindings; no participant counts. Description belongs to the pin and does not change its number frame or anchors. A pin frame has its tip at (x+width/2,y+height), with the number centered in its round head. IDs are unique; array order is back-to-front. expectedRevision guards concurrent edits. rect/roundedRect/ellipse display plain centered text in textColor. Standalone text is left-aligned safe Markdown, with textColor for text, fill for background and stroke for outline (initially transparent background/outline); tables/images/raw HTML are disabled. line/arrow use stroke and endpoints (x,y) to (x2,y2). startBinding/endBinding attach to a shape, standalone Markdown text frame, or any label, including text-only labels, via {objectId,anchor:top|right|bottom|left}; null detaches. Bound endpoints follow targets. fillOpacity (0..1) affects fill only, not stroke/text; new-object defaults are 0.3 (70% transparent). snap defaults to desk: follow settings.grid from desk_settings/desk_context (enabled, interval, origin). Shapes snap their top-left; all labels snap bottom-center. snap:exact bypasses the grid only for this batch without toggling the desk. Preserve explicit bindings; MCP never guesses nearby anchors. Position-only update batches with one common delta preserve relative positions, using snapAnchorId or their first object. Read placement.results for requested/applied final geometry, snapped and the grid used; applied:null means later deleted in the batch. grid_update changes persisted shared grid settings and participates in Undo; use it only when the human requests a global change, not for routine placement. UI selection-based auto-connection does not apply to MCP.', batchSchema.shape],
  ['desk_undo', 'Undo the latest shared action, whether human or agent. Advances revision.', { actor: z.string().min(1).max(100).default('agent-01') }],
  ['desk_redo', 'Redo the latest undone shared action. Advances revision.', { actor: z.string().min(1).max(100).default('agent-01') }],
] as const;
for (const [name, description, inputSchema] of tools) {
  mcp.registerTool(name, { description, inputSchema, annotations: { readOnlyHint: !['desk_select', 'desk_point', 'desk_execute', 'desk_undo', 'desk_redo'].includes(name), openWorldHint: ['desk_execute', 'desk_undo', 'desk_redo'].includes(name) } }, async (args: Record<string, unknown>): Promise<import('@modelcontextprotocol/sdk/types.js').CallToolResult> => {
    try {
      const method = name.replace('desk_', '') as Request['method'];
      const result = await compatibleRequest({ ...args, method } as Request);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (error) {
      return { isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }] };
    }
  });
}
registerAssetTools(mcp, compatibleRequest);
registerDeskFileTools(mcp, request);
registerPairingTools(mcp, gate, releaseDesk);
mcp.registerTool('desk_connection_info', {
  description: 'Get the current bootstrap URL without changing pairing state. For NEW/manual pairing first call desk_pairing_open with user approval. After pairing immediately retain desk_pairing_info privately for restart recovery. To recover an existing tab use desk_pairing_restore with that record, not a new URL or browser automation. If credentials are lost, ask the human to save or manually reconnect without reload. Only generated bootstrap tokens are included; configured TABLETOP_TOKEN is never disclosed. No HTTP token endpoint.',
  inputSchema: {}, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async () => ({ content: [{ type: 'text', text: JSON.stringify({
  url: connectionUrl, port, tokenSource: tokenFromEnv ? 'environment' : 'generated', tokenIncluded: !tokenFromEnv,
  browserConnected: browser?.readyState === WebSocket.OPEN,
  pairingState: gate.info() ? 'paired' : gate.canBootstrap ? 'new-pairing-open' : 'waiting-for-AI',
  message: tokenFromEnv ? 'For new/manual pairing first open desk_pairing_open with user approval, then enter your configured TABLETOP_TOKEN in the Connection tab. The configured token is not returned. For recovery restore the retained pairing record instead.'
    : 'For new/manual pairing first open desk_pairing_open with user approval, then use this URL. It contains a temporary secret; do not share it publicly. For recovery use desk_pairing_restore with the retained record instead.',
}) }] }));
http.on('error', error => { console.error('[Tabletop] Cannot listen:', error.message); process.exitCode = 1; void mcp.close(); });
await new Promise<void>((resolveReady, reject) => {
  http.once('error', reject);
  http.listen(port, '127.0.0.1', () => { http.off('error', reject); resolveReady(); });
});
console.error(`[Tabletop] Open ${connectionUrl}${tokenFromEnv ? ' (enter configured TABLETOP_TOKEN in the Connection tab)' : ''}`);
await mcp.connect(new StdioServerTransport());
let closing = false;
async function shutdown(reason: string) {
  if (closing) return;
  closing = true;
  console.error(`[Tabletop] ${new Date().toISOString()} Server stopping: ${reason}`);
  for (const ws of wss.clients) ws.close(1001, 'Server stopping');
  for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error('Server closing')); }
  pending.clear();
  wss.close(); http.close(); await mcp.close();
}
process.stdin.on('end', () => void shutdown('stdin ended'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
