import {pinFitFields} from './pin-fit';
import {wayfinderStartFields,wayfinderStartSchema} from './wayfinder-input';
import {DeskConnections,type DeskConnection} from './desk-connections';
import {deskTargetFields,deskTargetDescription,type DeskRequest} from './desk-target';
import { bellWaitFields } from './bell-wait.js';
import { registerPropTools } from './prop-tools.js';
import { registerStampTools } from './stamp-tools.js';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
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
const desks:DeskConnections=new DeskConnections(()=>network.isChanging,desk=>releaseDesk(desk,true),()=>handoffTicket.clear());
http.on('upgrade',(req,socket,head)=>{
 const url=new URL(req.url??'/',baseUrl),resume=url.searchParams.get('resume')==='1';
 if(url.pathname!=='/bridge'||(!resume&&url.searchParams.get('token')!==token&&!handoffTicket.allows(url.searchParams.get('token'),desks.acceptanceEpoch))||!network.allowsOrigin(req.headers.origin)||!network.allowsHost(req.headers.host)||!network.allowsPeer(req.socket.remoteAddress)){
  socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return;
 }
 if(!resume&&!desks.canBootstrap&&desks.connectedCount){socket.write('HTTP/1.1 409 Conflict\r\nConnection: close\r\n\r\n');socket.destroy();return;}
 if(network.isChanging||(!resume&&!desks.canBootstrap)||desks.pendingCount>=8){socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');socket.destroy();return;}
 wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
});
wss.on('connection',(ws:WebSocket,req:import('node:http').IncomingMessage)=>{
 if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress??''))remotePeers.add(ws);
 desks.accept(ws,new URL(req.url!,baseUrl).searchParams.get('resume')!=='1');
});
async function releaseDesk(desk:DeskConnection,handoff=false):Promise<Record<string,unknown>>{
 const lanHost=network.info().lanAddresses[0];
 if(handoff&&(!network.info().lanEnabled||!lanHost))throw Error('LAN authorization required');
 if(desk.releasing||network.isChanging)throw Error('Desk release or network change in progress');
 const peer=desk.peer;
 if(!peer||!desk.connected)throw Error('Desk is disconnected');
 if(!desk.releaseCapable)throw Error('Browser does not support intentional release. Save the desk before upgrading.');
 if(desk.fileBusy||desk.pending.size)throw Error('Desk requests are pending; inspect outcomes before releasing.');
 const ticketEpoch=handoff?desks.reserveAdmission():undefined;
 desk.releasing=true;desk.gate.suspend();
 try{
  const handoffUrl=handoff?`http://${network.authority(lanHost!)}/#token=${handoffTicket.issue(ticketEpoch!)}`:undefined;
  await acknowledgeRelease(peer,3000,handoffUrl);
  desk.sharing.revoke();desk.bell.disconnect();desk.peer=null;desks.remove(desk);peer.close(4003,'Desk released');
  const opened=handoff?desks.finishAdmission(true):desks.admissionReserved?{bootstrapReady:false,waitingFor:'pending-handoff'}:desks.open();
  return {...opened,deskId:desk.deskId,released:true};
 }catch(error){if(handoff){handoffTicket.clear();desks.finishAdmission(false);}throw error;}
 finally{desk.releasing=false;}
}
async function compatibleRequest(request:DeskRequest,payload: Request): Promise<unknown> {
  if(payload.method==='wayfinder_start'){const {method:_method,...start}=payload;wayfinderStartSchema.parse(start);}
  if (payload.method === 'camera_move') {
    const { method: _method, ...move } = payload;
    cameraMoveSchema.parse(move);
  }
  if (payload.method === 'execute') {
    const settings = z.object({ grid: gridSettingsSchema, name: z.string().optional(), background: z.unknown().optional() }).safeParse(await request({ method: 'settings' }));
    if (!settings.success) throw new Error('Browser does not support shared snap. Save the current desk before updating the browser; no edit was sent.');
    if (payload.operations.some(operation => operation.kind === 'desk_rename') && settings.data.name === undefined) throw new Error('Browser does not support desk names. Save the current desk before updating the browser; no edit was sent.');
    if (payload.operations.some(operation => operation.kind === 'background_update') && settings.data.background === undefined) throw new Error('Browser does not support wallpapers. Save the current desk before updating the browser; no edit was sent.');
  }
  return request(payload);
}
const mcp = new McpServer({ name: 'tabletop', version: '0.1.0' });
mcp.registerTool('desk_connections',{
 description:'List paired endpoints (no current desk), with deskId, connection state, name and background/title colors. Use names/colors/conversation to identify an endpoint, then supply its exact deskId on every individual tool. No model-level interpretation or backup guarantee is imposed.',inputSchema:{},annotations:{readOnlyHint:true,openWorldHint:false},
},async()=>({content:[{type:'text' as const,text:JSON.stringify({desks:await desks.list()})}]}));
mcp.registerTool('desk_message',{
 description:deskTargetDescription+'Show a temporary plain-text message above the bell on this desk. Replaces its previous message; no document edit or guaranteed receipt.',
 inputSchema:{...deskTargetFields,text:z.string().trim().min(1).max(2000),icon:z.enum(['info','success','warning','question','hint']).default('info'),durationMs:z.number().int().min(0).max(60000).default(8000)},
},async({deskId,...args})=>{try{const d=desks.get(deskId);d.bind();if(!d.toastCapable)throw Error('Browser has no message support');d.peer!.send(JSON.stringify({type:'desk_toast',...args}));return {content:[{type:'text' as const,text:JSON.stringify({deskId,status:'sent'})}]};}catch(e){return {isError:true,content:[{type:'text' as const,text:e instanceof Error?e.message:String(e)}]};}});
mcp.registerTool('desk_bell_wait',{
 description:deskTargetDescription+'Experimental bounded wait for a bell on this desk only. timeoutMs up to60000; timeout is normal. Supply epoch/afterSequence to detect changes. Waiting does not acknowledge the bell. The next targeted non-wait access acknowledges only this desk. No background wakeup, grouped wait or infinite polling. AI decides whether/how to wait on several desks. See desk_help bell-conversation.',
 inputSchema:{...deskTargetFields,...bellWaitFields},annotations:{readOnlyHint:true,openWorldHint:false},
},async({deskId,afterSequence,timeoutMs,epoch},extra)=>{try{const d=desks.get(deskId);if(!d.connected||!d.bellCapable)throw Error('No compatible desk connected');return {content:[{type:'text' as const,text:JSON.stringify({deskId,...await d.bell.wait(afterSequence,timeoutMs,epoch,extra.signal)})}]};}catch(e){return {isError:true,content:[{type:'text' as const,text:e instanceof Error?e.message:String(e)}]};}});
const tools = [
  ['desk_summary', 'Get name (empty means untitled), public paired-endpoint deskId, sessionId, revision, counts and undo/redo availability. Use the name normally and deskId only to distinguish same-named open desks. deskId identifies this paired endpoint, is not a credential or saved file identity, and survives LOAD and normal reconnection; sessionId remains the revision/load guard.', {}],
  ['desk_list', 'List objects in back-to-front order, excluding embedded image payloads and properties irrelevant to each type.', {}],
  ['desk_get', sharedReadDescriptions.desk_get, { id: z.string() }],
  ['desk_state', 'Get complete effective per-type object state including embedded assets; irrelevant properties are omitted. Potentially large. Prefer desk_context for semantic overview without embedded assets.', {}],
  ['desk_context', sharedReadDescriptions.desk_context, { sinceRevision: z.number().int().nonnegative().default(0), limit: z.number().int().min(1).max(200).default(100) }],
  ['desk_settings', 'Get the persisted desk name (name, empty means untitled), shared grid settings (enabled, interval, origin), background (wallpaper: none/wood-1/wood-2/wood/cutting-mat/pink-notebook, optional color/showGrid overrides), creation defaults and all pin series with IDs, names, shared appearance, counts and next number. Grid defaults to enabled, interval 24, origin (0,0). Shapes use top-left, labels bottom-center, free line endpoints their coordinates; explicit bindings take priority. Pins retain type label and label_add for compatibility. They are independent objects referenced by ID or seriesId plus number; repeated capped numbers require an ID.', {}],
  ['desk_selection', 'Get human selection IDs, independent aiPointing IDs and last known canvas pointer.', {}],
  ['desk_select', 'Set the human editing selection without changing revision or history. For AI questions or attention, use desk_point instead; edits target object IDs and do not require selection.', { ids: z.array(z.string()).max(200) }],
  ['desk_point', 'Show AI pointing frames colored for the wallpaper for questions or attention, independently of the human selection. Explain the target in chat and clear with ids: [] when finished. Replaces the AI pointing set; no move/resize handles, document revision or Undo changes. Edit by object ID, not by pointing. Deleted targets and disconnected sessions clear pointing.', { ids: z.array(z.string()).max(200) }],
  ['desk_changes', 'Get changes after a revision from this session; before/after metadata omit irrelevant per-type properties. Page via nextRevision.', { sinceRevision: z.number().int().nonnegative(), limit: z.number().int().min(1).max(200).default(100) }],
  ['desk_execute', 'Atomically edit objects and settings with shared Undo. Logical cutout: {kind:cutout,id:targetId,moldId:shapeId} copies a closed shape as a non-destructive content window on text/image/svg/mermaid/web. Original mold stays independent. Title bars are excluded. No rectangular overlap rejects without edits. cutout attributes publish enabled/path/source/layout; toggle enabled by an update with the full cutout object (geometry derives automatically); null removes/restores source. Visible geometry/anchors follow the window; resizing scales source and mask. Copy/save retain cutout.  To show a smooth move, first desk_point at the targets, then use a position-only update batch (x/y/x2/y2) translating all pointed targets by the same delta. Clip pointing also permits updating its base. Optional durationMs:0..2000 chooses the presentation time (omitted=350ms; 0=instant). It is not stored on parts or in desk settings. The browser eases resolved movement over that time, including attachments, and replies after presentation with optional animation:{status:completed|interrupted,durationMs,ids}. Content/appearance edits, different deltas or unpointed direct edits stay instant; separate text changes from movement. Final state/revision is committed once before presentation; reads/saves during it see final coordinates. Human input ends presentation at the committed final state; interrupted does not mean the move failed, and must not trigger replay. Reduced motion/hidden tabs skip easing. add and series_add use current creation defaults for omitted appearance. background_update changes only desk background via wallpaper (none/wood-1/wood-2/wood/cutting-mat/pink-notebook/charcoal), color (null = preset; pale plain surfaces use wallpaper:none with a color), titleBackground (hex #RRGGBB or null for the standard header; manual desk setting, independent of connection), opacity (0..1, default 1; 0 reveals the grayscale underlay; fades background color, texture and grid together without changing parts), underlayBrightness (0..1, black to white, default 0.5), showGrid (null = automatic), selectionColor and pointingColor (null = wallpaper preset). Optional originAxes (default false) shows non-editable world-zero cross axes with fixed 2 CSS px width; originAxesColor selects a fixed #RRGGBB color (default #94a3b8), without wallpaper adaptation. Setting wallpaper resets frame colors unless explicitly supplied in the same patch. It never changes part colors or snap settings. Use only on human request. defaults_update changes defaults; series_add/series_update define shared pin appearance, visibility (all/pins/hidden), thread settings (enabled/visible/color/width/opacity/dash), and format (pin,text,rect,roundedRect,ellipse frames; default pin). New series use compact dimensions based on font size unless dimensions are explicit; updates never auto-resize. Pins keep type label and label_add for compatibility. label_add requires id,seriesId,x,y, accepts optional description, and assigns current maximum plus one, capped by format. Labels allow only x/y/attachment/description/reactions/locked individual updates; delete/reorder are allowed. locked is per-object mouse-geometry protection, not a permission boundary: AI may freely move/edit locked objects. Omitted locked means false. Use desk_lock to set lock on the AI pointing set. Desk references use type:link with deskPath (a server-local .tabletop path), text and box geometry, no HTTP url. Existing get/execute read/edit them; ordinary selection does not open, the dedicated desk control switches after human confirmation. File moves/renames and other PCs are not tracked automatically. SVG props use type:prop with embedded SVG src and text as title; no anchors, URLs or open-in-tab controls. Optional propSelection:normal|head (absent=normal) controls human selection: head mode uses only the full-width title strip (34 world units, capped by height), passes artwork pointer hits through and limits selection frames/marquee to that strip. Human resize handles and size inputs are disabled until normal mode is restored; explicit AI geometry edits remain available. Copy/save/Undo retain this attribute. Use desk_prop_list/desk_prop_get for presets, or desk_asset_import(asProp:true) for custom SVGs. Rulers use type:ruler with rulerMembers:[{id,side:before|after}], rulerMode:free|gap|center, rulerMaterial:acrylic|bamboo|steel, rulerThickness:24|36|48 (default36), and derived rulerAxis:horizontal|vertical. Before is left/top, after is right/bottom. Rectangular resize normalizes short side and minimum long side120; equality retains the previous axis. Each side lays out independently. Free preserves along-axis position; gap equalizes signed edge gaps, center equalizes centers between the first/last outer edges. Zero members is allowed; one aligns at start. Adjacent center spacing is at least4 world units, allowing overflow. Member position edits in auto modes snap back: reorder rulerMembers for a different order. Move ruler x/y to translate all; changing axis preserves free offsets. Targets text/shapes/image/svg/mermaid/web/link only; no pins, lines, props, containers or other owners. One contiguous layer with ruler last, bundle lock, reorder and copy. Removing ruler leaves cards in place; deleting a member dissolves ruler like clip. File storage requires entire bundle and freezes membership, material, geometry controls and deletion until file release. See desk_help rulers for examples. Clear files use type:file with fileMembers (ordered IDs), box geometry, text title, fill/fillOpacity/stroke/strokeWidth and stamp/reactions. Put the file below a contiguous member block; member order is retained. Members may be shapes/lines/text/media/link or complete clip bundles, never pins/props/files or already-owned members. Include the entire clip bundle (clip plus every paper); UI expands partial clip selections. No empty files or nesting. Creating requires bounding the contents with margin24 and title34; use snap:exact and preserve member positions, or translate every member by the same grid correction as the file. Update file x/y to translate the whole group; updating member x/y together also translates the file. No individual resize, endpoint/binding/callout edits, reordering or file membership editing while contained. Clip structure controls and clip/paper deletion are frozen while filed. Text/colors remain editable. Delete the file to release its contents in place; ordinary members may be deleted, last member removes the empty file without resizing the frame. External connections follow but must not deform contents. Copy the file together with all members and remap IDs. Clip bundles use type:clip with ordered clipMembers IDs (text/image/svg/mermaid/web/link only), clipAnchor (eight outer anchors, default top-left), clipOffset (finite >=0, default32, no preset maximum), optional clipOffsetMode fixed|percent|base-short-side (absent=fixed), clipOffsetPercent (finite >=0, default30, allows >100). Percent mode cascades each next card from the previous card matching anchor: left/right uses previous width times percent, top/bottom previous height, corners both width and height with inward signs. At100 equal cards touch edge/corner; zero overlaps anchors. Resizing a paper reflows later papers. base-short-side mode uses the first paper shorter dimension times percent as a common Euclidean step along the inward anchor-to-center direction; reflows when the first paper is resized or replaced. Both percentage modes share clipOffsetPercent. Fixed distance and percentage are retained independently when switching modes, clipSize (default64) and clipStyle binder|wire. Optional clipAutoSize:true uses 15% of the first member short side, clamped to48..384, and follows base resize/replacement; clipSize retains the manual fallback. New clips default to clipAutoSize:true; set false for manual sizing. Legacy loaded clips with this field absent remain manual; an empty clip uses clipSize. fill is clip body color. First member is the base; followers align matching anchors inward by cumulative offset and have no usable anchors. Binding to followers is detached and never automatically restored. The group is contiguous in z-order, papers back-to-front followed by clip; reordering any member moves the group. Changing clip/member position translates the group; change membership first to move one paper independently. Remove a member ID to peel it, remaining members reflow from the current first paper. Deleting any member also deletes its clip but leaves surviving cards in place; deleting the clip releases all cards. No nesting or duplicate membership. Setting locked on any clip/member sets the entire bundle; previous individual lock states are not retained. Human geometry/membership edits and deletion require unlocking the bundle; AI edits remain allowed. Human shortcuts Ctrl/Meta+G and Shift+G group/ungroup; ordinary drag moves the bundle, Alt+paper drag peels one. Text parts support stamp:{designId,text,angle} or null to clear. Read desk_stamp_patterns for designs and behavior. Text, shapes, image/SVG/Mermaid/web/link cards support stickers:{items:[{color,shape:circle|star|triangle|diamond|alert-square-rounded|heart|seedling|michelin-star|award|trophy|mood-smile|paw|pig|confetti|ghost},...],origin:top-left|top-right|bottom-left|bottom-right,diameter:1..100000,fixed:boolean}; defaults are items:[], origin:top-right, diameter:36, fixed:false. Repeated colors and order are preserved; append by updating the full items array, clear via items:[], null removes settings. Sticker centers start one diameter inward from the corner and wrap with one diameter of horizontal inset; narrow cards always show one centered column, 20% diameter gap, with unlimited rows going down from top or up from bottom. fixed:true keeps screen size and reflows on zoom. Stickers have no individual selection/anchors; they follow the parent and copy/save/Undo. Not supported on line/pin/clip/prop. Read current values and use expectedRevision for array changes. Every object may have reactions: a unique array of up to 18 symbols (👍,👎,❓,❗,⭕,❌,✔,👀,❤️,🤔,🆗,💡,🎉,🙏,📌,⏳,⚠️,😊). Legacy ✅, ○ and ✕ remain valid as aliases of ✔, ⭕ and ❌ respectively; do not include both forms of an alias. The UI preserves existing legacy symbols until explicitly removed. update patch.reactions replaces the set; [] clears it. Read current reactions and use expectedRevision to avoid overwriting concurrent changes. Reactions attach as badges, share Undo, and do not change geometry or bindings; no participant counts. Optional label attachment is {objectId,anchor}, directly targeting text, any shape, image, SVG, Mermaid, web or link cards; null detaches. The persisted pin bottom-center follows the target anchor, including resize. No pin-to-pin or pin-to-line attachments. Lines bound to pins follow the moved pin, never pull it. Set attachment through an update after label_add, optionally in the same batch. Description belongs to the pin and does not change its number frame or anchors. A pin frame has its tip at (x+width/2,y+height), with the number centered in its round head. IDs are unique; array order is back-to-front. Pins in one series form one contiguous layer; reordering any member reorders the whole series. Pin glyphs and descriptions keep fixed screen sizes around their world bottom-center anchors. Threads join members in number order below their pins and are not objects. expectedRevision guards concurrent edits. Shapes rect/roundedRect/ellipse/diamond/parallelogram/cylinder/document/cloud display plain centered text in textColor. Optional textFit:auto scales text up/down; shrink only reduces the specified fontSize. Missing textFit preserves legacy fixed sizing. Fit approximates diamond/cloud/ellipse with an ellipse and others with a rectangle; explicit newlines only. New five shapes expose only top/right/bottom/left anchors; diagonal/center requests are rejected. Diamond cardinal anchors are its vertices, others use bounding-box approximation. Standalone text is left-aligned safe Markdown, with textColor for text, fill for background and stroke for outline (using the same creation appearance defaults as rectangles); tables/images/raw HTML are disabled. Text also supports cornerRadius and uniform padding (default 6 world units); a single text object can be a rounded card. Optional text.callout is {x,y,style?:speech|thought|leader,binding?:{objectId,anchor}|null}; null/absent disables its tail. Omitted style is speech (triangle); leader draws an outward stub, diagonal line and small endpoint dot; thought draws up to three separated circles, reduced in count for very short tails, without changing the tip binding. x/y are the world tip, root is computed automatically on the body edge. Tail binding targets text/shapes/pins/image/SVG/Mermaid/web/link cards, not lines or itself; target movement changes only the tip, never the text body. A free tip moves with the text body. UI offers callout on/off and a tip handle (Alt bypasses snapping). desk_text_measure reads overflow and needed height without editing. Ordinary type:link URL cards accept linkDisplay:url|qr (absent=url). URL mode shows a left-aligned wrapped URL with a chain icon scaled by fontSize; fill, fillOpacity, stroke, strokeWidth, textColor and cornerRadius control the URL appearance; QR mode ignores paint settings. Both modes retain a chain in the title. Switching modes preserves URL/geometry and stored text style. QR mode reuses the QR renderer and desk_asset_read; no duplicate qrText is stored on links. Desk-reference links are excluded. QR cards use type:qrcode with required qrText (up to 100000 characters), text as title and box geometry. Encode whitespace/newlines verbatim, using the existing qrcode library defaults and white quiet zone. With stickers, reserve one sticker diameter above and below the QR display, ignoring wrapped rows; fixed-size stickers track zoom. Display stays square inside a freely resizable outer card, with the same eight outer anchors, clip/ruler/file/cutout/sticker operations as Mermaid. Capacity overflow preserves qrText and displays a fallback QR encoding 長すぎます under a large white label with black 長すぎます. Do not truncate or auto-split. Empty input displays an input prompt. desk_asset_read returns its generated SVG with qrText/status/revision; no generated src is stored. Editable doodles use type:svg with doodle:{background:null|color,offset:{x,y},strokes:[{tool:pen|eraser,color,width,points:[{x,y}]}]}; src is generated from originals and card dimensions. Resizing changes paper only and preserves off-paper points. Read/update with existing tools; asset_read returns SVG. Ordinary SVG imports are not editable doodles. Mermaid originals use type:mermaid with required mermaidSource (up to 100000 characters), text as title, and box geometry. The browser renders SVG locally; source is retained even on syntax errors. Read source with desk_get; edit with desk_execute. Generated SVG is a view cache, not a document asset; desk_asset_read renders it and returns SVG with its source and revision. No conversion into editable primitives is performed. Connectors use type:line with stroke and endpoints (x,y) to (x2,y2). startMarker/endMarker independently select none/arrow/circle/diamond; omitted markers mean none. Legacy type:arrow is converted at entry to line with an arrow at the end; output/save use line only. Optional startJunction/endJunction identify symmetric point groups shared by line endpoints (null/absent = none). Same group follows a moved endpoint without propagating through opposite endpoints; closed triangles use separate groups. Set multiple endpoints to the same fresh ID atomically to join; set null to detach. Opposing explicit positions in a group are rejected. Deletion preserves surviving peers; singleton groups clear. UI Alt+endpoint drag detaches that endpoint; line-body movement peels shape bindings but preserves junctions. Optional junctionRounding (0..100000, omitted/0 = off) rounds two-line junctions visually: distance back along each line in world units. The larger adjacent value wins; rendering clamps to 45% of either line length. Branches, collinear joins, invisible lines and joins with endpoint markers stay unchanged. Logical endpoints and bindings are preserved. Optional dash is solid/dashed/dotted (omitted means solid). Lines also support fixedWidth:boolean (omitted=false): false scales stroke/dashes/markers with desk zoom, true keeps their screen sizes fixed (marker size is still capped for very short lines). Path positions and junction rounding remain world geometry. Pin series thread.fixedWidth uses the same meaning and defaults false, including older missing values. UI switches read zoom-following on the left and fixed width on the right; fixed width is ON. PNG/PDF scene export resolves both at canonical 100% scale. startBinding/endBinding attach to a shape, standalone Markdown text frame, image/SVG/Mermaid/web/link card, or any label, including text-only labels, via {objectId,anchor:top|right|bottom|left|top-left|top-right|bottom-left|bottom-right|center}; null detaches. Existing rect/roundedRect/ellipse, text and image/SVG/Mermaid/web/link cards expose eight outline anchors; diamond/parallelogram/cylinder/document/cloud expose four cardinal anchors; pins expose center only for new mouse snapping. Legacy pin side bindings remain supported. Bound endpoints follow targets. fillOpacity (0..1) affects fill only, not stroke/text; new-object defaults are 0.3 (70% transparent). snap defaults to desk: follow settings.grid from desk_settings/desk_context (enabled, interval, origin). Shapes snap their top-left; all labels snap bottom-center. snap:exact bypasses the grid only for this batch without toggling the desk. Preserve explicit bindings; MCP never guesses nearby anchors. Position-only update batches with one common delta preserve relative positions, using snapAnchorId or their first object. Read placement.results for requested/applied final geometry, snapped and the grid used; applied:null means later deleted in the batch. desk_rename with name (trimmed single line, max 100 characters, empty means untitled) changes the persisted desk name with shared Undo; use only on human request, not to identify a connection. The public paired-endpoint deskId is immutable and not saved. grid_update changes persisted shared grid settings and participates in Undo; use it only when the human requests a global change, not for routine placement. Image/SVG/Mermaid anchors use the outer card rectangle, including its title, not the rendered image bounds or transparency. Wayfinders use type:wayfinder, optional attachment:{objectId,anchor} to a card/shape/media target and attachmentAnchor:top|right|bottom|left selecting its own attachment point (omitted=bottom for legacy data), and ordinary box/paint fields. Optional wayfinderMode:move|tour defaults to move. Move eases and caps travel time; tour follows at constant 120 CSS px/s without the 5s cap. The mode is stored per wayfinder and selected in properties. Route lines bind any of top/right/bottom/left, including the attachment point, with one endpoint connection total per wayfinder. Human dragging attaches the nearest of its four anchors; artwork remains upright. Selection shows a fixed-screen-size launch popup instead of an embedded button. UI launch follows explicit line junctions at fixed zoom; branches pause at the direction map; loops stop safely. See docs_devel/wayfinder.md. Props have no anchors. UI selection-based auto-connection does not apply to MCP.', batchSchema.shape],
  ['desk_fit', 'Move the shared camera to fit the AI pointing set, or the whole desk when it is empty. First set targets with desk_point; never reads or replaces the human selection. No object geometry, revision or Undo changes. Returns target IDs, scope and applied camera. This moves the human view: use only when appropriate to the conversation, not for ordinary reads. Refuses human-only thinking mode, active editing/gestures, and during or within 400ms of wheel/native scrolling (including sidebar/page scrolling). Scrolling cancels the request, without queuing or automatic retry. Animates browser-side and replies after completion. Optional durationMs: 0..2000 (0 instant); omitted uses distance-based 250..900ms. Long moves may pull back. Respects reduced motion. Human input, viewport/lifecycle changes or superseding commands stop at the current view and return a cancellation error; never automatically retry.', cameraAnimationFields],
  ['desk_lock', 'Set mouse-geometry lock on the current AI pointing set (desk_point), independently of human selection. Requires locked:true or false; never toggles implicitly. Empty pointing is an error, never the whole desk. Up to 200 objects atomically with one Undo; optional expectedRevision guards concurrent edits. Expands clip/member targets to their whole bundles and returns affected IDs, lock state and revision. Lock blocks human pointer drag/resize/endpoint changes only. Double-click editing, properties, keyboard actions and all AI edits remain allowed. Lock persists in desk files and is not a permission boundary. Refuses human-only thinking mode and active editing. Do not retry automatically after refusal.', lockFields],
  ['desk_ui_get', 'Read the connected browser UI theme (light/dark). This local browser preference is independent of wallpaper and desk files, and can change without a desk revision. Also exposed as ui.theme in desk_context. Allowed in human-only thinking mode.', {}],
  ['desk_ui_set', 'Set the connected browser UI theme explicitly to light or dark, only when requested by the human. Persists in browser localStorage, updates the moon/sun button, and does not change wallpaper, objects, selection, camera, desk revision, Undo or saved desk files. Refused in human-only thinking mode. Requires a compatible browser.', { theme: z.enum(['light', 'dark']) }],
  ['desk_wayfinder_start', 'Move the human camera only when requested or appropriate to the conversation, never for routine reads. Start route travel by either wayfinder id OR lineId plus from:start|end, never both. Optional mode:move|tour overrides only this run; omitted uses the wayfinder setting or move for a raw line. A raw line route requires no wayfinder object and may use transparent lines. The human camera follows explicit joints and pauses at branches for a fixed-scale direction map; arrows do not restrict travel. Returns status:started immediately. Read desk_camera_get.navigation for the latest moving/waiting/completed/cancelled/failed status and reason; this is not push notification or a completion promise. Human input/document changes can cancel; do not retry automatically. No object edits, selection, revision or Undo changes. Human-only mode, editing/confirmation and recent scrolling refuse launch. No speed, timeline or simultaneous-object-animation controls.', wayfinderStartFields],
  ['desk_camera_get', 'Read the current camera without moving it. Optional navigation reports the latest route runId, status and stop reason (moving/waiting/completed/cancelled/failed), including branch choices while waiting. No push or guarantee of continued travel. World center, zoom (1 = 100%), viewport width/height in CSS pixels, and visibleBounds in world units. Bounds describe the canvas rectangle, not occlusion by UI controls. Allowed during human-only thinking mode. No selection, geometry, revision or history changes.', {}],
  ['desk_pin_fit', 'Fit all pin frames in the explicitly specified seriesIds to their current font and current/next label text, using exactly the human fit button measurement. Multiple series are one atomic Undo action. Does not change font size, selection, camera or attachments. Set font size first with series_update when needed. Optional expectedRevision guards concurrent edits. Requires browser fonts loaded.', pinFitFields],
  ['desk_text_measure', 'Measure live rendered text in world units for text (Markdown), rect and roundedRect. Returns sessionId/revision and per-ID status, overflow x/y, requiredHeight at current width, and canFitByHeight. Plain shape text has explicit newlines only, no auto-wrap. Horizontal overflow cannot be fixed by height alone. Uses rectangular frame bounds, not rounded-corner contours; tolerance 1 world unit. Unsupported types and fonts still loading return explicit statuses. Read-only: no edits, selection, history or camera changes; allowed in thinking mode. Specify 1..200 IDs. Requires a compatible browser.', textMeasureFields],
  ['desk_camera_move', 'Adjust the shared human view without moving objects. Specify at least one field: center (absolute world point) OR pan (relative world delta; positive x looks right, positive y looks down), and/or zoom (absolute 0.05..8, 1 = 100%) OR zoomBy (factor 0.01..100, e.g. 1.25). Zoom preserves the current world center unless center/pan is supplied; combined pan and zoom use a world-unit delta independent of zoom. Relative zoom clamps to 0.05..8 and returns zoomClamped. Returns the same view fields as desk_camera_get plus zoomClamped. Does not read or replace either selection, change revision/Undo or persist in desk files. Use for requested viewing/navigation, not routine reads. Refuses active human editing/gestures and human-only thinking mode. During or within 400ms of wheel/native scrolling (including sidebar/page scrolling), the request is cancelled without queuing. No automatic retry or replay. Animates browser-side and replies after completion. Optional durationMs: 0..2000 (0 instant); omitted uses distance-based 250..900ms. Long moves may pull back. Respects reduced motion. Human input, viewport/lifecycle changes or superseding commands stop at the current view and return a cancellation error; never automatically retry.', cameraMoveFields],
  ['desk_undo', 'Undo the latest shared action, whether human or agent. Advances revision.', { actor: z.string().min(1).max(100).default('agent-01') }],
  ['desk_redo', 'Redo the latest undone shared action. Advances revision.', { actor: z.string().min(1).max(100).default('agent-01') }],
] as const;
for (const [name, description, inputSchema] of tools) {
  mcp.registerTool(name, { description:deskTargetDescription+description, inputSchema:{...deskTargetFields,...inputSchema}, annotations: { readOnlyHint: !['desk_pin_fit', 'desk_select', 'desk_point', 'desk_fit', 'desk_lock', 'desk_camera_move', 'desk_wayfinder_start', 'desk_ui_set', 'desk_execute', 'desk_undo', 'desk_redo'].includes(name), openWorldHint: ['desk_execute', 'desk_undo', 'desk_redo'].includes(name) } }, async (args: Record<string, unknown>): Promise<import('@modelcontextprotocol/sdk/types.js').CallToolResult> => {
    try {
      const {deskId,...payload}=args;
      const request=desks.bind(deskId as string);
      const method = name.replace('desk_', '') as Request['method'];
      const result = await compatibleRequest(request,{ ...payload, method } as Request);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (error) {
      return { isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }] };
    }
  });
}
registerBrowserTools(mcp,async()=>{
 const names=new Set((await desks.list()).filter(d=>d.connected).map(d=>d.name||'無題'));
 let initialName='無題',i=2;while(names.has(initialName))initialName=`無題(${i++})`;
 return {url:`${baseUrl}#token=${encodeURIComponent(token)}&port=${port}`,listening:network.info().listening,accepting:desks.canBootstrap&&!network.isChanging,connected:desks.connectedCount>0,initialName};
});
registerPortTools(mcp,async target=>{
 if(desks.entries.size)throw Error('Release all paired desks before changing the server port.');
 if(desks.pendingCount||network.isChanging)throw Error('Connection activity is in progress');
 const previousPort=port,changed=await network.setPort(target);port=changed.port;baseUrl=`http://127.0.0.1:${port}/`;
 connectionUrl=tokenFromEnv?baseUrl:`${baseUrl}#token=${encodeURIComponent(token)}&port=${port}`;
 if(port!==previousPort)handoffTicket.clear();return {previousPort,...changed,changed:port!==previousPort};
});
registerHelpTools(mcp);registerStampTools(mcp);registerPropTools(mcp);
registerAssetTools(mcp,deskId=>{const request=desks.bind(deskId);return payload=>compatibleRequest(request,payload);});
registerDeskFileTools(mcp,deskId=>desks.bind(deskId));
registerShareTools(mcp,deskId=>{const d=desks.get(deskId);d.bind();return d.sharing;});
registerPairingTools(mcp,desks,releaseDesk);
registerNetworkTools(mcp,async enabled=>{
 if([...desks.entries].some(d=>d.releasing))throw Error('Desk release in progress');
 if(!enabled&&[...desks.entries].some(d=>d.peer&&remotePeers.has(d.peer)&&d.pending.size))throw Error('Remote browser requests pending; inspect outcomes before closing LAN.');
 const result=await network.setLan(enabled);if(!enabled){handoffTicket.clear();for(const peer of wss.clients)if(remotePeers.has(peer))peer.terminate();}return result;
});
function connectionStatus(){
 const browserConnected=desks.connectedCount>0;
 const pairingState=desks.canBootstrap?'new-pairing-open':desks.entries.size?'paired':'waiting-for-AI';
 const guidance=connectionGuidance(browserConnected,pairingState);
 return {browserConnected,pairingState,...guidance,connectionCount:desks.connectedCount,
  message:guidance.message+' '+(tokenFromEnv?'The configured TABLETOP_TOKEN is not returned; append it manually when connecting.':'The URL contains a temporary secret; do not share it publicly.')};
}
mcp.registerTool('desk_connection_info', {
  description: 'Get bootstrap URL, network status (including listening), and enabled LAN URLs without changing pairing or network access. Follow state-specific nextAction (ask-user, browser-connect, wait-for-browser, call-tool). waiting-for-AI requires choosing new/manual pairing versus recovery before using desk_browser_open (OS default browser) or presenting a URL; a URL alone cannot open acceptance. bootstrapReady means acceptance is open, not connected. paired means credentials are registered, not necessarily connected; only browserConnected:true confirms a connected browser. Only explicit human authorization allows desk_network_set to open LAN. For a device handoff explicitly desk_release the old desk first; content is never automatically saved, copied or loaded. If a nonempty original desk has unspecified content disposition, consider asking once whether to transfer it; this is advisory, not mandatory. For NEW/manual pairing first call desk_pairing_open with user approval unless release already opened acceptance. After pairing call desk_connections, then retain desk_pairing_info({deskId}) privately for each endpoint. All individual tools require deskId even with one desk; there is no current desk. Additional pairing leaves existing desks connected. After process restart restore authorized LAN intent if needed, then desk_pairing_restore with the exact record, never a new URL or browser automation. If credentials are lost, ask the human to save or manually reconnect without reload. Only generated tokens are included; configured TABLETOP_TOKEN is never disclosed and must be manually URL-encoded in #token= by the user. No HTTP token endpoint.',
  inputSchema: {}, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async () => ({ content: [{ type: 'text', text: JSON.stringify({
  url: connectionUrl, port, tokenSource: tokenFromEnv ? 'environment' : 'generated', tokenIncluded: !tokenFromEnv,
  network: network.info(),
  connections:[...desks.entries].map(d=>({...d.metadata,deskId:d.deskId,connected:d.connected})),
  lanUrls: network.info().lanAddresses.map(host => {
    const url = `http://${network.authority(host)}/`;
    return tokenFromEnv ? url : `${url}#token=${encodeURIComponent(token)}&port=${port}`;
  }),
  ...connectionStatus(),
}) }] }));
http.on('error', error => {
  console.error('[Tabletop] Cannot listen:', error.message);
  if (!network.isChanging && (error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
    console.error(`[Tabletop] ポート${network.port}は使用中です。別のCodex・CopilotなどでTabletopが起動している可能性があります（他のアプリの場合もあります）。`);
    console.error('[Tabletop] 既存のサーバーや机を勝手に終了しないでください。既存の机を継続する場合は、起動元のエージェントから操作してください。');
    console.error('[Tabletop] 独立した机サーバーを起動する場合は、MCP起動設定の環境変数TABLETOP_PORTに別の空きポート（例: 4318）を指定し、このMCP接続だけを再起動してください。');
    console.error('[Tabletop] このサーバーはMCPツールを公開する前に起動失敗しています。「ツールがない」ときもMCP起動ログを確認してください。詳細: README.md「MCPツールが見つからない・ポート使用中」');
  }
  if (!network.isChanging) { process.exitCode = 1; void mcp.close(); }
});
await network.listen();
console.error(`[Tabletop] Open ${connectionUrl}${tokenFromEnv ? ' (manually append #token=<URL-encoded configured TABLETOP_TOKEN> in the Connection tab)' : ''}`);
const stdio=new StdioServerTransport();
await mcp.connect(stdio);
let closing = false;
async function shutdown(reason: string) {
  if (closing) return;
  closing = true;
  desks.close();
  console.error(`[Tabletop] ${new Date().toISOString()} Server stopping: ${reason}`);
  for (const ws of wss.clients) ws.close(1001, 'Server stopping');
  wss.close(); http.close();
  await Promise.allSettled([...desks.entries].map(d=>d.sharing.close())); // An opening share also aborts when its browser closes.
  await mcp.close();
}
process.stdin.on('end', () => void shutdown('stdin ended'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
