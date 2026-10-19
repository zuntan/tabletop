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
import { textMeasureFields } from './text-measure.js';
import { registerBrowserTools } from './browser-tools.js';
import { registerHelpTools } from './help-tools.js';
import { registerAssetTools } from './asset-tools.js';
import { registerDeskFileTools } from './desk-file-tools.js';
import { isStaticPathInside } from './static-path.js';
import { PairingGate } from './pairing-server.js';
import { connectionGuidance } from './connection-guidance.js';
import { registerPairingTools } from './pairing-tools.js';
import { acknowledgeRelease } from './desk-release.js';
import { NetworkAccess } from './network-access.js';
import { registerPortTools } from './port-tools.js';
import { registerNetworkTools } from './network-tools.js';
import { HandoffTicket } from './handoff-ticket.js';
import { cameraAnimationFields, cameraMoveFields, cameraMoveSchema } from './camera-control.js';
import { lockFields } from './object-lock.js';
import { sharedReadDescriptions } from './read-tool-descriptions.js';
import { DeskShareServer } from './share-server.js';
import { registerShareTools } from './share-tools.js';

const handoffTicket = new HandoffTicket();

let port = Number(process.env.TABLETOP_PORT ?? 4317);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid TABLETOP_PORT');
const tokenFromEnv = process.env.TABLETOP_TOKEN !== undefined;
const token = process.env.TABLETOP_TOKEN ?? randomBytes(16).toString('base64url');
let baseUrl = `http://127.0.0.1:${port}/`;
let connectionUrl = tokenFromEnv ? baseUrl : `${baseUrl}#token=${encodeURIComponent(token)}&port=${port}`;
if (token.length < 22) throw new Error('TABLETOP_TOKEN must be at least 22 characters');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const http = createServer(async (req, res) => {
  const host = req.headers.host;
  if (!network.allowsHost(host) || !network.allowsPeer(req.socket.remoteAddress)) { res.writeHead(403).end(); return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', `http://${host}`).pathname);
    if (pathname === '/connection-policy') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ allowedHosts: network.hosts() })); return;
    }
    const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!isStaticPathInside(root, path)) { res.writeHead(403).end(); return; }
    const body = await readFile(path);
    res.writeHead(200, {
      'Content-Type': mime[extname(path)] ?? 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: http:; frame-src https: http:; connect-src 'self' ws://127.0.0.1:* ws://localhost:* ${network.hosts(true).slice(2).map(host => `ws://${network.authority(host)}`).join(' ')}; object-src 'none'; base-uri 'none'`,
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Run npm run build first.'); }
});
const network = new NetworkAccess(http, port);
const wss = new WebSocketServer({ noServer: true, maxPayload: 24_000_000 });
const remotePeers = new WeakSet<WebSocket>();
let browser: WebSocket | null = null;
let releasing = false;
const releaseCapable = new WeakSet<WebSocket>();
const gate = new PairingGate(() => browser !== null || releasing);
const pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();
const sharing = new DeskShareServer(request, () => browser?.readyState === WebSocket.OPEN ? browser : null);

http.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);

  const resume = url.searchParams.get('resume') === '1';
  if (url.pathname !== '/bridge' || (!resume && url.searchParams.get('token') !== token && !handoffTicket.allows(url.searchParams.get('token'), gate.acceptanceEpoch)) ||
      !network.allowsOrigin(req.headers.origin) || !network.allowsHost(req.headers.host) ||
      !network.allowsPeer(req.socket.remoteAddress)) {
    socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); socket.destroy(); return;
  }
  if (browser && !resume) { socket.write('HTTP/1.1 409 Conflict\r\nConnection: close\r\n\r\n'); socket.destroy(); return; }
  if (releasing || network.isChanging || (!resume && !gate.canBootstrap) || gate.pendingCount >= 8) { socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n'); socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
});
function attachBrowser(ws: WebSocket) {
  browser = ws;
  handoffTicket.clear();

  ws.on('message', data => {
    try {
      const message = JSON.parse(data.toString());
      if (browser !== ws) return;
      if (message.type === 'handoff_request') {
        void releaseDesk(true).catch(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'handoff_error', error: '引き渡しできませんでした。LANの許可・接続状態・処理中の操作を確認してください。' }));
        });
        return;
      }
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
    sharing.revoke();
    browser = null;
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error('Browser disconnected; operation outcome may be unknown. Inspect revision before retrying.')); }
    pending.clear();
  });
}
wss.on('connection', (ws: WebSocket, req: import('node:http').IncomingMessage) => {
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '')) remotePeers.add(ws);
  gate.accept(ws, new URL(req.url!, baseUrl).searchParams.get('resume') !== '1', () => attachBrowser(ws));
});
function request(payload: Request): Promise<unknown> {
  return new Promise((resolveResult, reject) => {
    if (releasing) { reject(new Error('Desk release in progress; no request was sent.')); return; }
    if (network.isChanging) { reject(new Error('Network listener change in progress; no request was sent.')); return; }
    if (!browser || browser.readyState !== WebSocket.OPEN) { reject(new Error('No browser connected. Call desk_connection_info and follow its state-specific nextAction. A URL alone does not open pairing acceptance; do not automatically call desk_pairing_open for recovery.')); return; }
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
async function releaseDesk(handoff = false) {
  const lanHost = network.info().lanAddresses[0];
  if (handoff && (!network.info().lanEnabled || !lanHost)) throw new Error('LAN authorization required');
  if (releasing) throw new Error('Desk release already in progress');
  if (network.isChanging) throw new Error('Network listener change in progress; no release was sent.');
  const peer = browser;
  if (!peer || peer.readyState !== WebSocket.OPEN) throw new Error('No browser connected. Call desk_connection_info and follow its state-specific nextAction; do not automatically open new acceptance for recovery.');
  if (!releaseCapable.has(peer)) throw new Error('Browser does not support intentional release. Save the desk before upgrading; no disconnect was sent.');
  if (pending.size) throw new Error('Browser requests are pending; wait for completion and inspect their outcomes before releasing.');
  releasing = true;
  gate.suspend();
  try {
    const handoffUrl = handoff ? `http://${network.authority(lanHost!)}/#token=${handoffTicket.issue(gate.acceptanceEpoch + 1)}` : undefined;
    await acknowledgeRelease(peer, 3000, handoffUrl);
    sharing.revoke();
    browser = null;
    peer.close(4003, 'Desk released');
    releasing = false;
    return { ...gate.open(), released: true };
  } finally { releasing = false; }
}
async function compatibleRequest(payload: Request): Promise<unknown> {
  if (payload.method === 'camera_move') {
    const { method: _method, ...move } = payload;
    cameraMoveSchema.parse(move);
  }
  if (payload.method === 'execute') {
    const peer = browser;
    const settings = z.object({ grid: gridSettingsSchema, name: z.string().optional(), background: z.unknown().optional() }).safeParse(await request({ method: 'settings' }));
    if (!settings.success) throw new Error('Browser does not support shared snap. Save the current desk before updating the browser; no edit was sent.');
    if (payload.operations.some(operation => operation.kind === 'desk_rename') && settings.data.name === undefined) throw new Error('Browser does not support desk names. Save the current desk before updating the browser; no edit was sent.');
    if (payload.operations.some(operation => operation.kind === 'background_update') && settings.data.background === undefined) throw new Error('Browser does not support wallpapers. Save the current desk before updating the browser; no edit was sent.');
    if (browser !== peer) throw new Error('Browser changed during compatibility check; refresh state before editing.');
  }
  return request(payload);
}
const mcp = new McpServer({ name: 'tabletop', version: '0.1.0' });
const tools = [
  ['desk_summary', 'Get name (empty means untitled), public per-tab deskId, sessionId, revision, counts and undo/redo availability. Use the name normally and deskId only to distinguish same-named open desks. deskId is not a credential, is not saved, and is stable across load/reconnection; sessionId remains the revision/load guard.', {}],
  ['desk_list', 'List objects in back-to-front order, excluding embedded image payloads and properties irrelevant to each type.', {}],
  ['desk_get', sharedReadDescriptions.desk_get, { id: z.string() }],
  ['desk_state', 'Get complete effective per-type object state including embedded assets; irrelevant properties are omitted. Potentially large. Prefer desk_context for semantic overview without embedded assets.', {}],
  ['desk_context', sharedReadDescriptions.desk_context, { sinceRevision: z.number().int().nonnegative().default(0), limit: z.number().int().min(1).max(200).default(100) }],
  ['desk_settings', 'Get the persisted desk name (name, empty means untitled), shared grid settings (enabled, interval, origin), background (wallpaper: none/wood-1/wood-2/wood/cutting-mat/pink-notebook, optional color/showGrid overrides), creation defaults and all pin series with IDs, names, shared appearance, counts and next number. Grid defaults to enabled, interval 24, origin (0,0). Shapes use top-left, labels bottom-center, free line endpoints their coordinates; explicit bindings take priority. Pins retain type label and label_add for compatibility. They are independent objects referenced by ID or seriesId plus number; repeated capped numbers require an ID.', {}],
  ['desk_selection', 'Get human selection IDs, independent aiPointing IDs and last known canvas pointer.', {}],
  ['desk_select', 'Set the human editing selection without changing revision or history. For AI questions or attention, use desk_point instead; edits target object IDs and do not require selection.', { ids: z.array(z.string()).max(200) }],
  ['desk_point', 'Show AI pointing frames colored for the wallpaper for questions or attention, independently of the human selection. Explain the target in chat and clear with ids: [] when finished. Replaces the AI pointing set; no move/resize handles, document revision or Undo changes. Edit by object ID, not by pointing. Deleted targets and disconnected sessions clear pointing.', { ids: z.array(z.string()).max(200) }],
  ['desk_changes', 'Get changes after a revision from this session; before/after metadata omit irrelevant per-type properties. Page via nextRevision.', { sinceRevision: z.number().int().nonnegative(), limit: z.number().int().min(1).max(200).default(100) }],
  ['desk_execute', 'Atomically edit objects and settings with shared Undo. add and series_add use current creation defaults for omitted appearance. background_update changes only desk background via wallpaper (none/wood-1/wood-2/wood/cutting-mat/pink-notebook/charcoal), color (null = preset), opacity (0..1, default 1; 0 reveals the grayscale underlay; fades background color, texture and grid together without changing parts), underlayBrightness (0..1, black to white, default 0.5), showGrid (null = automatic), selectionColor and pointingColor (null = wallpaper preset). Setting wallpaper resets frame colors unless explicitly supplied in the same patch. It never changes part colors or snap settings. Use only on human request. defaults_update changes defaults; series_add/series_update define shared pin appearance, visibility (all/pins/hidden), thread settings (enabled/visible/color/width/opacity/dash), and format (pin,text,rect,roundedRect,ellipse frames; default pin). New series use compact dimensions based on font size unless dimensions are explicit; updates never auto-resize. Pins keep type label and label_add for compatibility. label_add requires id,seriesId,x,y, accepts optional description, and assigns current maximum plus one, capped by format. Labels allow only x/y/attachment/description/reactions/locked individual updates; delete/reorder are allowed. locked is per-object mouse-geometry protection, not a permission boundary: AI may freely move/edit locked objects. Omitted locked means false. Use desk_lock to set lock on the AI pointing set. Every object may have reactions: a unique array of up to 18 symbols (👍,👎,❓,❗,⭕,❌,✔,👀,❤️,🤔,🆗,💡,🎉,🙏,📌,⏳,⚠️,😊). Legacy ✅, ○ and ✕ remain valid as aliases of ✔, ⭕ and ❌ respectively; do not include both forms of an alias. The UI preserves existing legacy symbols until explicitly removed. update patch.reactions replaces the set; [] clears it. Read current reactions and use expectedRevision to avoid overwriting concurrent changes. Reactions attach as badges, share Undo, and do not change geometry or bindings; no participant counts. Optional label attachment is {objectId,anchor}, directly targeting text or any shape only; null detaches. The persisted pin bottom-center follows the target anchor, including resize. No pin-to-pin or pin-to-line attachments. Lines bound to pins follow the moved pin, never pull it. Set attachment through an update after label_add, optionally in the same batch. Description belongs to the pin and does not change its number frame or anchors. A pin frame has its tip at (x+width/2,y+height), with the number centered in its round head. IDs are unique; array order is back-to-front. Pins in one series form one contiguous layer; reordering any member reorders the whole series. Pin glyphs and descriptions keep fixed screen sizes around their world bottom-center anchors. Threads join members in number order below their pins and are not objects. expectedRevision guards concurrent edits. Shapes rect/roundedRect/ellipse/diamond/parallelogram/cylinder/document/cloud display plain centered text in textColor. Optional textFit:auto scales text up/down; shrink only reduces the specified fontSize. Missing textFit preserves legacy fixed sizing. Fit approximates diamond/cloud/ellipse with an ellipse and others with a rectangle; explicit newlines only. New five shapes expose only top/right/bottom/left anchors; diagonal/center requests are rejected. Diamond cardinal anchors are its vertices, others use bounding-box approximation. Standalone text is left-aligned safe Markdown, with textColor for text, fill for background and stroke for outline (using the same creation appearance defaults as rectangles); tables/images/raw HTML are disabled. Text also supports cornerRadius and uniform padding (default 6 world units); a single text object can be a rounded card. Optional text.callout is {x,y,style?:speech|thought|leader,binding?:{objectId,anchor}|null}; null/absent disables its tail. Omitted style is speech (triangle); leader draws an outward stub, diagonal line and small endpoint dot; thought draws up to three separated circles, reduced in count for very short tails, without changing the tip binding. x/y are the world tip, root is computed automatically on the body edge. Tail binding targets text/shapes/pins, not lines or itself; target movement changes only the tip, never the text body. A free tip moves with the text body. UI offers callout on/off and a tip handle (Alt bypasses snapping). desk_text_measure reads overflow and needed height without editing. Mermaid originals use type:mermaid with required mermaidSource (up to 100000 characters), text as title, and box geometry. The browser renders SVG locally; source is retained even on syntax errors. Read source with desk_get; edit with desk_execute. Generated SVG is a view cache, not a document asset; desk_asset_read renders it and returns SVG with its source and revision. No conversion into editable primitives is performed. Connectors use type:line with stroke and endpoints (x,y) to (x2,y2). startMarker/endMarker independently select none/arrow/circle/diamond; omitted markers mean none. Legacy type:arrow is converted at entry to line with an arrow at the end; output/save use line only. Optional startJunction/endJunction identify symmetric point groups shared by line endpoints (null/absent = none). Same group follows a moved endpoint without propagating through opposite endpoints; closed triangles use separate groups. Set multiple endpoints to the same fresh ID atomically to join; set null to detach. Opposing explicit positions in a group are rejected. Deletion preserves surviving peers; singleton groups clear. UI Alt+endpoint drag detaches that endpoint; line-body movement peels shape bindings but preserves junctions. Optional junctionRounding (0..100000, omitted/0 = off) rounds two-line junctions visually: distance back along each line in world units. The larger adjacent value wins; rendering clamps to 45% of either line length. Branches, collinear joins, invisible lines and joins with endpoint markers stay unchanged. Logical endpoints and bindings are preserved. Optional dash is solid/dashed/dotted (omitted means solid). startBinding/endBinding attach to a shape, standalone Markdown text frame, or any label, including text-only labels, via {objectId,anchor:top|right|bottom|left|top-left|top-right|bottom-left|bottom-right|center}; null detaches. Existing rect/roundedRect/ellipse and text expose eight outline anchors; diamond/parallelogram/cylinder/document/cloud expose four cardinal anchors; pins expose center only for new mouse snapping. Legacy pin side bindings remain supported. Bound endpoints follow targets. fillOpacity (0..1) affects fill only, not stroke/text; new-object defaults are 0.3 (70% transparent). snap defaults to desk: follow settings.grid from desk_settings/desk_context (enabled, interval, origin). Shapes snap their top-left; all labels snap bottom-center. snap:exact bypasses the grid only for this batch without toggling the desk. Preserve explicit bindings; MCP never guesses nearby anchors. Position-only update batches with one common delta preserve relative positions, using snapAnchorId or their first object. Read placement.results for requested/applied final geometry, snapped and the grid used; applied:null means later deleted in the batch. desk_rename with name (trimmed single line, max 100 characters, empty means untitled) changes the persisted desk name with shared Undo; use only on human request, not to identify a connection. The public per-tab deskId is immutable and not saved. grid_update changes persisted shared grid settings and participates in Undo; use it only when the human requests a global change, not for routine placement. UI selection-based auto-connection does not apply to MCP.', batchSchema.shape],
  ['desk_fit', 'Move the shared camera to fit the AI pointing set, or the whole desk when it is empty. First set targets with desk_point; never reads or replaces the human selection. No object geometry, revision or Undo changes. Returns target IDs, scope and applied camera. This moves the human view: use only when appropriate to the conversation, not for ordinary reads. Refuses human-only thinking mode, active editing/gestures, and during or within 400ms of wheel/native scrolling (including sidebar/page scrolling). Scrolling cancels the request, without queuing or automatic retry. Animates browser-side and replies after completion. Optional durationMs: 0..2000 (0 instant); omitted uses distance-based 250..900ms. Long moves may pull back. Respects reduced motion. Human input, viewport/lifecycle changes or superseding commands stop at the current view and return a cancellation error; never automatically retry.', cameraAnimationFields],
  ['desk_lock', 'Set mouse-geometry lock on the current AI pointing set (desk_point), independently of human selection. Requires locked:true or false; never toggles implicitly. Empty pointing is an error, never the whole desk. Up to 200 objects atomically with one Undo; optional expectedRevision guards concurrent edits. Returns IDs, lock state and revision. Lock blocks human pointer drag/resize/endpoint changes only. Double-click editing, properties, keyboard actions and all AI edits remain allowed. Lock persists in desk files and is not a permission boundary. Refuses human-only thinking mode and active editing. Do not retry automatically after refusal.', lockFields],
  ['desk_ui_get', 'Read the connected browser UI theme (light/dark). This local browser preference is independent of wallpaper and desk files, and can change without a desk revision. Also exposed as ui.theme in desk_context. Allowed in human-only thinking mode.', {}],
  ['desk_ui_set', 'Set the connected browser UI theme explicitly to light or dark, only when requested by the human. Persists in browser localStorage, updates the moon/sun button, and does not change wallpaper, objects, selection, camera, desk revision, Undo or saved desk files. Refused in human-only thinking mode. Requires a compatible browser.', { theme: z.enum(['light', 'dark']) }],
  ['desk_camera_get', 'Read the current camera without moving it: world center, zoom (1 = 100%), viewport width/height in CSS pixels, and visibleBounds in world units. Bounds describe the canvas rectangle, not occlusion by UI controls. Allowed during human-only thinking mode. No selection, geometry, revision or history changes.', {}],
  ['desk_text_measure', 'Measure live rendered text in world units for text (Markdown), rect and roundedRect. Returns sessionId/revision and per-ID status, overflow x/y, requiredHeight at current width, and canFitByHeight. Plain shape text has explicit newlines only, no auto-wrap. Horizontal overflow cannot be fixed by height alone. Uses rectangular frame bounds, not rounded-corner contours; tolerance 1 world unit. Unsupported types and fonts still loading return explicit statuses. Read-only: no edits, selection, history or camera changes; allowed in thinking mode. Specify 1..200 IDs. Requires a compatible browser.', textMeasureFields],
  ['desk_camera_move', 'Adjust the shared human view without moving objects. Specify at least one field: center (absolute world point) OR pan (relative world delta; positive x looks right, positive y looks down), and/or zoom (absolute 0.05..8, 1 = 100%) OR zoomBy (factor 0.01..100, e.g. 1.25). Zoom preserves the current world center unless center/pan is supplied; combined pan and zoom use a world-unit delta independent of zoom. Relative zoom clamps to 0.05..8 and returns zoomClamped. Returns the same view fields as desk_camera_get plus zoomClamped. Does not read or replace either selection, change revision/Undo or persist in desk files. Use for requested viewing/navigation, not routine reads. Refuses active human editing/gestures and human-only thinking mode. During or within 400ms of wheel/native scrolling (including sidebar/page scrolling), the request is cancelled without queuing. No automatic retry or replay. Animates browser-side and replies after completion. Optional durationMs: 0..2000 (0 instant); omitted uses distance-based 250..900ms. Long moves may pull back. Respects reduced motion. Human input, viewport/lifecycle changes or superseding commands stop at the current view and return a cancellation error; never automatically retry.', cameraMoveFields],
  ['desk_undo', 'Undo the latest shared action, whether human or agent. Advances revision.', { actor: z.string().min(1).max(100).default('agent-01') }],
  ['desk_redo', 'Redo the latest undone shared action. Advances revision.', { actor: z.string().min(1).max(100).default('agent-01') }],
] as const;
for (const [name, description, inputSchema] of tools) {
  mcp.registerTool(name, { description, inputSchema, annotations: { readOnlyHint: !['desk_select', 'desk_point', 'desk_fit', 'desk_lock', 'desk_camera_move', 'desk_ui_set', 'desk_execute', 'desk_undo', 'desk_redo'].includes(name), openWorldHint: ['desk_execute', 'desk_undo', 'desk_redo'].includes(name) } }, async (args: Record<string, unknown>): Promise<import('@modelcontextprotocol/sdk/types.js').CallToolResult> => {
    try {
      const method = name.replace('desk_', '') as Request['method'];
      const result = await compatibleRequest({ ...args, method } as Request);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (error) {
      return { isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }] };
    }
  });
}
registerBrowserTools(mcp, () => ({ url: `${baseUrl}#token=${encodeURIComponent(token)}&port=${port}`,
  listening: network.info().listening, accepting: gate.canBootstrap && !releasing && !network.isChanging, connected: browser?.readyState === WebSocket.OPEN }));
registerPortTools(mcp, async target => {
  if (browser || gate.info()) throw new Error('Release the connected desk first. Preserve its contents with desk_save before an approved port handoff. For a disconnected registered pairing, resolve recovery versus manual replacement first.');
  if (releasing || pending.size || gate.pendingCount || network.isChanging) throw new Error('Connection activity is in progress; no port change was started.');
  const previousPort = port;
  const changed = await network.setPort(target);
  port = changed.port;
  baseUrl = `http://127.0.0.1:${port}/`;
  connectionUrl = tokenFromEnv ? baseUrl : `${baseUrl}#token=${encodeURIComponent(token)}&port=${port}`;
  if (port !== previousPort) { handoffTicket.clear(); sharing.revoke(); }
  return { previousPort, ...changed, changed: port !== previousPort,
    message: 'Runtime port updated; TABLETOP_PORT startup configuration is unchanged. Follow desk_connection_info, open the browser, then explicitly restore the saved desk if requested.' };
});
registerHelpTools(mcp);
registerAssetTools(mcp, compatibleRequest);
registerDeskFileTools(mcp, request);
registerShareTools(mcp, sharing);
registerPairingTools(mcp, gate, releaseDesk);
registerNetworkTools(mcp, async enabled => {
  if (releasing) throw new Error('Desk release in progress; network listener was not changed.');
  if (!enabled && browser && remotePeers.has(browser) && pending.size) throw new Error('Remote browser requests are pending; inspect outcomes before closing LAN.');
  const result = await network.setLan(enabled);
  if (!enabled) handoffTicket.clear();
  if (!enabled) for (const peer of wss.clients) if (remotePeers.has(peer)) peer.terminate();
  return result;
});
function connectionStatus() {
  const browserConnected = browser?.readyState === WebSocket.OPEN;
  const pairingState = gate.info() ? 'paired' : gate.canBootstrap ? 'new-pairing-open' : 'waiting-for-AI';
  const guidance = connectionGuidance(browserConnected, pairingState);
  const tokenMessage = tokenFromEnv
    ? 'The configured TABLETOP_TOKEN is not returned; when instructed to connect, manually append #token=<URL-encoded configured TABLETOP_TOKEN> in the Connection tab.'
    : 'The URL contains a temporary secret; do not share it publicly.';
  return { browserConnected, pairingState, ...guidance, message: `${guidance.message} ${tokenMessage}` };
}
mcp.registerTool('desk_connection_info', {
  description: 'Get bootstrap URL, network status (including listening), and enabled LAN URLs without changing pairing or network access. Follow state-specific nextAction (ask-user, browser-connect, wait-for-browser, call-tool). waiting-for-AI requires choosing new/manual pairing versus recovery before using desk_browser_open (OS default browser) or presenting a URL; a URL alone cannot open acceptance. bootstrapReady means acceptance is open, not connected. paired means credentials are registered, not necessarily connected; only browserConnected:true confirms a connected browser. Only explicit human authorization allows desk_network_set to open LAN. For a device handoff explicitly desk_release the old desk first; content is never automatically saved, copied or loaded. If a nonempty original desk has unspecified content disposition, consider asking once whether to transfer it; this is advisory, not mandatory. For NEW/manual pairing first call desk_pairing_open with user approval unless release already opened acceptance. After pairing immediately retain desk_pairing_info privately for recovery. After process restart restore authorized LAN intent if needed, then desk_pairing_restore with the exact record, never a new URL or browser automation. If credentials are lost, ask the human to save or manually reconnect without reload. Only generated tokens are included; configured TABLETOP_TOKEN is never disclosed and must be manually URL-encoded in #token= by the user. No HTTP token endpoint.',
  inputSchema: {}, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async () => ({ content: [{ type: 'text', text: JSON.stringify({
  url: connectionUrl, port, tokenSource: tokenFromEnv ? 'environment' : 'generated', tokenIncluded: !tokenFromEnv,
  network: network.info(),
  lanUrls: network.info().lanAddresses.map(host => {
    const url = `http://${network.authority(host)}/`;
    return tokenFromEnv ? url : `${url}#token=${encodeURIComponent(token)}&port=${port}`;
  }),
  ...connectionStatus(),
}) }] }));
http.on('error', error => {
  console.error('[Tabletop] Cannot listen:', error.message);
  if (!network.isChanging) { process.exitCode = 1; void mcp.close(); }
});
await network.listen();
console.error(`[Tabletop] Open ${connectionUrl}${tokenFromEnv ? ' (manually append #token=<URL-encoded configured TABLETOP_TOKEN> in the Connection tab)' : ''}`);
await mcp.connect(new StdioServerTransport());
let closing = false;
async function shutdown(reason: string) {
  if (closing) return;
  closing = true;
  sharing.revoke();
  console.error(`[Tabletop] ${new Date().toISOString()} Server stopping: ${reason}`);
  for (const ws of wss.clients) ws.close(1001, 'Server stopping');
  for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error('Server closing')); }
  pending.clear();
  wss.close(); http.close();
  await sharing.close().catch(() => {}); // An opening share also aborts when its browser closes.
  await mcp.close();
}
process.stdin.on('end', () => void shutdown('stdin ended'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
