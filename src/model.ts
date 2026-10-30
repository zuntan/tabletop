import {pdfExportFields} from './pdf-export';
import {captureFields,type CaptureInput} from './desk-capture';
import {pinFitFields} from './pin-fit';
import {doodleSchema,doodleSource} from './doodle-values';
import {assertRulerOperation} from './ruler-layout';
import {assertFileOperation,fileGroup,fileFor} from './clear-files';
import { cutoutSchema, cutoutTarget, applyCutoutPatch, normalizeCutoutPatch } from './logical-cutout';
import { clipGroup, clipFor } from './clip-bundles';
import { publishObject } from './object-properties';
import { groupPinLayers } from './pin-series';
import { z } from 'zod';
import { resolveConnections, anchorNames } from './geometry';
import { initialSettings, settingsOperations, applySettingsOperation, materializeLabels, creationAppearance, nextNumber, formatNumber, settingsSchema } from './settings';
import type { Settings } from './settings';
import { deskContext } from './desk-context';
import { reactions, reactionChoices, canonicalReaction } from './reaction-values';
import { checkDeskBridgeSize } from './desk-file-protocol';
import { ImageGeometry } from './image-geometry';
import { createGridPlacement, placementGeometry } from './grid-placement';
import { createDeskId } from './desk-identity';
import { randomUuid } from './portable-crypto';
import { cameraAnimationFields, cameraMoveFields, cameraMoveSchema, type CameraBridge } from './camera-control';
import { lockFields, lockOperations } from './object-lock';
import { shareRead } from './share-read';
import { stickerSchema, stickerTarget } from './sticker-values';
import {wayfinderStartFields,wayfinderStartSchema} from './wayfinder-input';
import { textMeasureFields, type TextMeasureBridge } from './text-measure';

const coordinate = z.number().finite().min(-1_000_000).max(1_000_000);
const dimension = z.number().finite().min(1).max(100_000);
const color = z.string().regex(/^(#[0-9a-fA-F]{3,8}|transparent|[a-zA-Z]{1,20})$/);
const safeUrl = (value: string) => {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); }
  catch { return false; }
};
const source = z.string().max(8_000_000).refine(value =>
  safeUrl(value) || /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=\s]+$/.test(value),
  'Expected an HTTP(S) URL or a base64 image data URL',
);

const bindingSchema = z.object({
  objectId: z.string().min(1).max(100),
  anchor: z.enum(anchorNames),
}).strict();

export const endpointShapeSchema = z.enum(['none', 'arrow', 'circle', 'diamond']);
const objectFields = z.object({
  id: z.string().min(1).max(100),
  type: z.enum(['rect', 'roundedRect', 'ellipse', 'diamond', 'parallelogram', 'cylinder', 'document', 'cloud', 'line', 'text', 'image', 'svg', 'mermaid', 'qrcode', 'prop', 'clip', 'ruler', 'file', 'web', 'link', 'label', 'wayfinder']),
  cornerRadius: z.number().finite().min(0).max(100_000).default(16),
  padding: z.number().finite().min(0).max(100_000).optional(),
  rulerMembers: z.array(z.object({id:z.string().min(1).max(100),side:z.enum(['before','after'])}).strict()).max(1999).optional(),
  rulerMode:z.enum(['free','gap','center']).optional(),
  rulerMaterial:z.enum(['acrylic','bamboo','steel']).optional(),
  rulerThickness:z.union([z.literal(24),z.literal(36),z.literal(48)]).optional(),
  rulerAxis:z.enum(['horizontal','vertical']).optional(),
  fileMembers: z.array(z.string().min(1).max(100)).max(1999).optional(),
  clipMembers: z.array(z.string().min(1).max(100)).optional(),
  clipAnchor: z.enum(['top','right','bottom','left','top-left','top-right','bottom-left','bottom-right']).optional(),
  clipOffset: z.number().finite().min(0).optional(),
  clipOffsetMode: z.enum(['fixed','percent','base-short-side']).optional(),
  clipOffsetPercent: z.number().finite().min(0).optional(),
  clipSize: z.number().finite().min(1).max(100000).optional(),
  clipAutoSize: z.boolean().optional(),
  clipStyle: z.enum(['binder','wire']).optional(),
  locked: z.boolean().optional(), // Mouse geometry protection only; not an authorization boundary.
  propSelection: z.enum(['normal', 'head']).optional(),
  wayfinderMode: z.enum(['move','tour']).optional(),
  attachmentAnchor:z.enum(['top','right','bottom','left']).optional(),
  seriesId: z.string().min(1).max(100).optional(),
  number: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).optional(),
  labelShape: z.enum(['text', 'rect', 'ellipse', 'roundedRect', 'pin']).optional(),
  description: z.string().max(20_000).optional(),
  cutout: cutoutSchema.nullable().optional(),
  stamp: z.object({ designId: z.string().min(1).max(200), text: z.string().max(10000), angle: z.number().finite().min(-360).max(360) }).strict().nullable().optional(),
  reactions: z.array(z.enum(reactions)).max(reactionChoices.length).refine(values => new Set(values.map(canonicalReaction)).size === values.length, 'Duplicate reactions are not allowed').optional(),
  reactionSize: z.number().finite().min(1).max(100000).optional(),
  stickers: stickerSchema.nullable().optional(),
  x: coordinate.default(0),
  y: coordinate.default(0),
  x2: coordinate.optional(),
  y2: coordinate.optional(),
  callout: z.object({ x: coordinate, y: coordinate, style: z.enum(['speech', 'thought', 'leader']).optional(), binding: bindingSchema.nullable().optional() }).strict().nullable().optional(),
  attachment: bindingSchema.nullable().optional(),
  fixedWidth:z.boolean().optional(),
  junctionRounding: z.number().finite().min(0).max(100000).optional(),
  startJunction: z.string().min(1).max(200).nullable().optional(),
  endJunction: z.string().min(1).max(200).nullable().optional(),
  startBinding: bindingSchema.nullable().optional(),
  endBinding: bindingSchema.nullable().optional(),
  width: dimension.default(180),
  height: dimension.default(100),
  fill: color.default('#dbeafe'),
  fillOpacity: z.number().finite().min(0).max(1).default(1),
  stroke: color.default('#334155'),
  strokeWidth: z.number().finite().min(0).max(100).default(2),
  dash: z.enum(['solid', 'dashed', 'dotted']).optional(),
  startMarker: endpointShapeSchema.optional(),
  endMarker: endpointShapeSchema.optional(),
  text: z.string().max(100_000).default(''),
  textColor: color.default('#0f172a'),
  textFit: z.enum(['auto', 'shrink']).optional(),
  fontSize: z.number().finite().min(1).max(1000).default(24),
  mermaidSource: z.string().max(100_000).optional(),
  qrText: z.string().max(100_000).optional(),
  doodle:doodleSchema.optional(),
  linkDisplay:z.enum(['url','qr']).optional(),
  src: source.optional(),
  deskPath: z.string().min(1).max(4096).refine(value=>!/[\x00-\x1f]/.test(value)&&value.endsWith('.tabletop')).optional(),
  url: z.string().max(4096).refine(value => value === '' || safeUrl(value), 'Expected an HTTP(S) URL').optional(),
}).strict();

/** Legacy arrow is accepted only at entry, then everything uses a line. */
function normalizeLegacyConnector(input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  const object = input as Record<string, unknown>;
  if (object.type !== 'line' && object.type !== 'arrow') return input;
  return { ...object, type: 'line', startMarker: object.startMarker === undefined ? 'none' : object.startMarker,
    endMarker: object.endMarker === undefined ? (object.type === 'arrow' ? 'arrow' : 'none') : object.endMarker };
}
export const objectSchema = z.preprocess(normalizeLegacyConnector, objectFields);
export const patchSchema = objectFields.omit({ id: true, type: true }).partial();
const addObjectFields = objectFields.partial().required({ id: true, type: true });
const addObjectSchema = addObjectFields.extend({ type: z.enum(['rect', 'roundedRect', 'ellipse', 'diamond', 'parallelogram', 'cylinder', 'document', 'cloud', 'line', 'arrow', 'text', 'image', 'svg', 'mermaid', 'qrcode', 'prop', 'clip', 'ruler', 'file', 'web', 'link', 'label', 'wayfinder']) })
  .transform(object => normalizeLegacyConnector(object) as z.input<typeof addObjectFields>);
export const operationSchema = z.discriminatedUnion('kind', [
  ...settingsOperations,
  z.object({ kind: z.literal('add'), object: addObjectSchema }).strict(),
  z.object({ kind: z.literal('update'), id: z.string(), patch: patchSchema }).strict(),
  z.object({ kind: z.literal('cutout'), id: z.string(), moldId: z.string() }).strict(),
  z.object({ kind: z.literal('delete'), id: z.string() }).strict(),
  z.object({ kind: z.literal('reorder'), id: z.string(), index: z.number().int().min(0) }).strict(),
]);
export const batchSchema = z.object({
  operations: z.array(operationSchema).min(1).max(200),
  actor: z.string().min(1).max(100).default('agent-01'),
  expectedRevision: z.number().int().nonnegative().optional(),
  snap: z.enum(['desk', 'exact']).default('exact'),
  snapAnchorId: z.string().min(1).max(100).optional(),
  durationMs: z.number().finite().min(0).max(2000).optional(),
}).strict();
// The UI commits resolved coordinates; public MCP calls follow the desk unless explicitly exact.
export const mcpBatchSchema = batchSchema.extend({ snap: batchSchema.shape.snap.default('desk') });

export type DeskObject = z.infer<typeof objectSchema>;
export type Operation = z.infer<typeof operationSchema>;
export type Batch = z.input<typeof batchSchema>;
export type Change = {
  revision: number;
  operation: 'batch' | 'undo' | 'redo';
  actor: string;
  timestamp: string;
  targets: string[];
  settings?: { before: Settings; after: Settings };
  details: { id: string; before?: DeskObject; after?: DeskObject; beforeIndex?: number; afterIndex?: number }[];
};
type Snapshot = DeskObject[];
type Entry = { replacement?:boolean; before: Snapshot; after: Snapshot; beforeSettings: Settings; afterSettings: Settings; actor: string; targets: string[] };

function validateObject(object: unknown): DeskObject {
  const parsed = objectSchema.parse(object);
  if(parsed.doodle){if(parsed.type!=='svg')throw Error('Doodle belongs only to SVG cards');parsed.src=doodleSource(parsed.doodle,parsed.width,Math.max(1,parsed.height-34));}
  if(parsed.type!=='line'&&parsed.fixedWidth!==undefined)throw new Error('Fixed width belongs only to lines');
  if(parsed.type!=='wayfinder'&&parsed.attachmentAnchor!==undefined)throw new Error('Attachment anchor belongs only to wayfinders');
  if(parsed.type!=='wayfinder'&&parsed.wayfinderMode!==undefined)throw new Error('Wayfinder mode belongs only to wayfinders');
  if(parsed.type!=='ruler'&&['rulerMembers','rulerMode','rulerMaterial','rulerThickness','rulerAxis'].some(key=>(parsed as Record<string,unknown>)[key]!==undefined))throw Error('Ruler fields belong only to rulers');
  if(parsed.type!=='file'&&parsed.fileMembers!==undefined)throw new Error('File members belong only to files');
  if(parsed.type!=='clip' && ['clipMembers','clipAnchor','clipOffset','clipOffsetMode','clipOffsetPercent','clipSize','clipAutoSize','clipStyle'].some(key=>(parsed as Record<string,unknown>)[key]!==undefined)) throw new Error('Clip fields belong only to clips');
  if(parsed.stickers && !stickerTarget(parsed)) throw new Error('Stickers require text, shape or media cards');
  if(parsed.linkDisplay!==undefined&&(parsed.type!=='link'||parsed.deskPath))throw new Error('Link display belongs only to ordinary URL links');
  if(parsed.type==='qrcode'&&parsed.qrText===undefined)throw new Error('QR text required');
  if(parsed.type!=='qrcode'&&parsed.qrText!==undefined)throw new Error('QR text belongs only to QR cards');
  if (parsed.type === 'mermaid' && parsed.mermaidSource === undefined) throw new Error('Mermaid source required');
  if (['image', 'svg', 'prop'].includes(parsed.type) && !parsed.src) throw new Error('Image source required');
  if (parsed.deskPath && (parsed.type!=='link'||parsed.url)) throw new Error('Desk links require type link, deskPath and no URL');
  if (['web', 'link'].includes(parsed.type) && !parsed.url && !parsed.deskPath) throw new Error('URL required');
  if (parsed.type === 'prop' && (!parsed.src?.startsWith('data:image/svg+xml;base64,') || parsed.url)) throw new Error('Props require embedded SVG and cannot have links');
  if (parsed.cutout && (!cutoutTarget(parsed)||parsed.height<=(parsed.type==='text'?0:34))) throw new Error('Invalid cutout target or content size');
  if (parsed.stamp && !['text','file'].includes(parsed.type)) throw new Error('Stamps are supported on text parts only and clear files');
  return parsed;
}

/** The sole committed state writer for both UI and MCP operations. */
export class Desk {
  readonly sessionId = randomUuid();
  deskId = createDeskId();
  readonly imageGeometry = new ImageGeometry();
  revision = 0;
  documentGeneration=randomUuid();
  filePath:string|null=null;
  fileNameHint='';
  private savedRevision=0;
  hasUnsavedChanges(){return this.revision!==this.savedRevision;}
  markSaved(revision:number){
    if(revision!==this.revision)return false;
    this.savedRevision=revision;return true;
  }
  private objects: Snapshot = [];
  private settings: Settings = initialSettings();
  private undoStack: Entry[] = [];
  private redoStack: Entry[] = [];
  private changes: Change[] = [];
  private selection: string[] = [];
  private aiPointing: string[] = [];
  pointer: { x: number; y: number } | null = null;

  snapshot(): Snapshot { return structuredClone(this.objects); }
  settingsSnapshot(): Settings { return structuredClone(this.settings); }
  listSettings() {
    const settings = this.settingsSnapshot();
    return { ...settings, series: settings.series.map(series => {
      const labels = this.objects.filter(object => object.type === 'label' && object.seriesId === series.id);
      const next = nextNumber(labels, series);
      return { ...series, count: labels.length, max: labels.reduce((max, label) => Math.max(max, label.number ?? 0), 0),
        next, nextText: formatNumber(series.format, next) };
    }) };
  }
  pointed(): string[] { return [...this.aiPointing]; }
  point(ids: string[]) {
    const valid = new Set(this.objects.map(object => object.id));
    if (ids.some(id => !valid.has(id))) throw new Error('Unknown pointing ID');
    this.aiPointing = [...new Set(ids)];
    return { ids: this.pointed() };
  }
  selected(): string[] { return [...this.selection]; }
  select(ids: string[]) {
    const valid = new Set(this.objects.map(o => o.id));
    if (ids.some(id => !valid.has(id))) throw new Error('Unknown selection ID');
    this.selection = [...new Set(ids)];
    return { ids: this.selected() };
  }
  summary() {
    const types: Record<string, number> = {};
    for (const object of this.objects) types[object.type] = (types[object.type] ?? 0) + 1;
    return { sessionId: this.sessionId, deskId: this.deskId, name: this.settings.name, revision: this.revision, count: this.objects.length,
      types, canUndo: this.undoStack.length > 0, canRedo: this.redoStack.length > 0 };
  }
  list() {
    return this.objects.map((object, zIndex) => {
      const { src, ...published } = publishObject(object);
      return { ...published, zIndex, ...this.imageGeometry.describe(object),
        ...(src ? { asset: { source: src.startsWith('data:') ? 'embedded' : src, length: src.length } } : {}) };
    });
  }

  get(id: string) {
    const object = this.objects.find(o => o.id === id);
    if (!object) throw new Error(`Unknown object: ${id}`);
    return structuredClone(object);
  }
  getChanges(since: number, limit = 100) {
    if (!Number.isInteger(since) || since < 0 || since > this.revision) throw new Error('Invalid revision for this session');
    const changes = this.changes.filter(c => c.revision > since).slice(0, limit);
    return { sessionId: this.sessionId, currentRevision: this.revision,
      nextRevision: changes.at(-1)?.revision ?? since, hasMore: this.revision > (changes.at(-1)?.revision ?? since),
      changes: changes.map(c => ({ ...c, details: c.details.map(d => ({ ...d,
        before: d.before ? this.metadata(d.before) : undefined,
        after: d.after ? this.metadata(d.after) : undefined,
      })) })) };
  }
  private metadata(object: DeskObject) {
    const { src, ...rest } = publishObject(object);
    return { ...rest, ...(src ? { asset: { source: src.startsWith('data:') ? 'embedded' : src, length: src.length } } : {}) };
  }
  replaceDocument(input: unknown, actor = 'human') {
    const document = z.object({ objects: z.array(objectSchema).max(2000), settings: settingsSchema }).strict().parse(input);
    if (new Set(document.objects.map(object => object.id)).size !== document.objects.length) throw new Error('Duplicate object ID');
    if (new Set(document.settings.series.map(series => series.id)).size !== document.settings.series.length) throw new Error('Duplicate series ID');
    const after = groupPinLayers(resolveConnections(materializeLabels(document.objects.map(validateObject), document.settings)).map(validateObject));
    const before = this.snapshot(), beforeSettings = this.settingsSnapshot();
    const targets = [...new Set([...before, ...after].map(object => object.id))];
    this.undoStack.push({ replacement:true, before, after, beforeSettings, afterSettings: document.settings, actor, targets });
    this.redoStack = [];
    this.commit(after, before, 'batch', actor, targets, document.settings);
    this.documentGeneration=randomUuid();this.filePath=null;this.fileNameHint='';
    this.selection = []; this.aiPointing = []; this.pointer = null;
    this.markSaved(this.revision);
    return this.summary();
  }
  execute(input: Batch) {
    const batch = batchSchema.parse(input);
    if (batch.expectedRevision !== undefined && batch.expectedRevision !== this.revision) throw new Error('Revision conflict: refresh before editing');
    const before = this.snapshot();
    const beforeSettings = this.settingsSnapshot();
    const afterSettings = this.settingsSnapshot();
    let after = this.snapshot();
    const placement = createGridPlacement(batch, before, value => objectSchema.parse(value));
    for (const inputOperation of batch.operations) {
      const normalized = placement.normalize(inputOperation, materializeLabels(after, afterSettings), afterSettings);
      const operation = normalized.kind==='cutout' ? (()=>{
        const target=after.find(o=>o.id===normalized.id),mold=after.find(o=>o.id===normalized.moldId);
        if(!target||!mold||target.id===mold.id)throw new Error('型と対象を一つずつ選んでください');
        return {kind:'update' as const,id:target.id,patch:applyCutoutPatch(target,mold)};
      })() : normalized;
      if (operation.kind === 'desk_rename' || operation.kind === 'grid_update' || operation.kind === 'background_update' || operation.kind === 'defaults_update' || operation.kind === 'series_add'
        || operation.kind === 'series_update' || operation.kind === 'label_add') {
        applySettingsOperation(operation, after, afterSettings);
        continue;
      }
      if (operation.kind === 'add') {
        if(operation.object.type==='ruler'&&operation.object.rulerMembers?.some(m=>fileFor(after,m.id)||batch.actor==='human'&&after.find(o=>o.id===m.id)?.locked))throw Error('ファイル内やロック中のカードは定規へ追加できません');
        if(operation.object.type==='clip'&&operation.object.clipMembers?.some(id=>{const owner=fileFor(after,id);return owner&&before.some(o=>o.id===owner.id);}))throw new Error('ファイル内ではクリップの追加・組み替えはできません');
        if (after.some(o => o.id === operation.object.id)) throw new Error(`Duplicate ID: ${operation.object.id}`);
        if (after.length >= 2000) throw new Error('Object limit reached');
        if (operation.object.type === 'label') throw new Error('Use label_add to create a series label');
        if (batch.actor === 'human' && operation.object.type === 'clip' && operation.object.clipMembers?.some(id => after.find(object => object.id === id)?.locked))
          throw new Error('ロック中の紙はクリップへ追加できません');
        after.push(validateObject({ ...creationAppearance(operation.object.type, afterSettings.defaults), ...(operation.object.type === 'clip' ? {fill:'#26313d',clipAutoSize:true} : {}), ...operation.object }));
        continue;
      }
      const index = after.findIndex(o => o.id === operation.id);
      if (index < 0) throw new Error(`Unknown object: ${operation.id}`);
      const bundle = clipFor(after, operation.id);
      if (batch.actor === 'human') {
        const structural = operation.kind === 'delete' || operation.kind === 'update' && Object.keys(operation.patch).some(key =>
          ['x', 'y', 'width', 'height', 'clipMembers', 'clipAnchor', 'clipOffset', 'clipOffsetMode', 'clipOffsetPercent', 'clipSize', 'clipAutoSize'].includes(key));
        if (bundle && structural && clipGroup(after, operation.id).some(object => object.locked))
          throw new Error('クリップの束をロック解除してから操作してください');
        if (operation.kind === 'update' && operation.patch.clipMembers?.some(id =>
          !bundle?.clipMembers?.includes(id) && after.find(object => object.id === id)?.locked))
          throw new Error('ロック中の紙はクリップへ追加できません');
      }
      assertRulerOperation(after,operation,batch.actor);
      if(operation.kind==='update'&&operation.patch.rulerMembers?.some(m=>{const previous=after.find(o=>o.id===operation.id)?.rulerMembers;return !previous?.some(p=>p.id===m.id)&&(fileFor(after,m.id)||batch.actor==='human'&&after.find(o=>o.id===m.id)?.locked);}))throw Error('ファイル内やロック中のカードは定規へ追加できません');
      assertFileOperation(after,operation);
      if (operation.kind === 'update') {
        if(after[index].doodle&&operation.patch.src!==undefined&&operation.patch.doodle===undefined)throw Error('Update doodle originals instead of replacing their generated SVG source');
        if (after[index].type === 'label' && Object.keys(operation.patch).some(key => !['x', 'y', 'attachment', 'description', 'reactions', 'reactionSize', 'locked'].includes(key))) {
          throw new Error('Labels allow only position, attachment, description, reaction and mouse lock updates; use series_update for shared appearance');
        }
        after[index] = validateObject({ ...after[index], ...normalizeCutoutPatch(after[index],operation.patch) });
        if (operation.patch.locked !== undefined) {
          const ids = new Set(fileGroup(after, operation.id).map(object => object.id));
          after = after.map(object => ids.has(object.id) ? { ...object, locked: operation.patch.locked } : object);
        }
      }
      if (operation.kind === 'delete') after.splice(index, 1);
      if (operation.kind === 'reorder') {
        const object = after[index];
        const group = object.type === 'label' ? after.filter(item => item.type === 'label' && item.seriesId === object.seriesId) : fileGroup(after,object.id);
        const members = new Set(group.map(item => item.id));
        after = after.filter(item => !members.has(item.id));
        after.splice(Math.min(operation.index, after.length), 0, ...group);
      }
    }
    after = groupPinLayers(resolveConnections(materializeLabels(after, afterSettings).map(validateObject), before).map(validateObject));
    const result = () => ({ ...this.summary(), placement: { mode: placement.mode, results: placement.results.map(item => {
      const object = after.find(object => object.id === item.id);
      return { ...item, applied: object ? placementGeometry(object) : null };
    }) } });
    if (JSON.stringify(before) === JSON.stringify(after)
      && JSON.stringify(beforeSettings) === JSON.stringify(afterSettings)) return result();
    const targets = [...new Set(batch.operations.map(op => op.kind === 'add' ? op.object.id
      : op.kind === 'desk_rename' ? 'name' : op.kind === 'grid_update' ? 'grid' : op.kind === 'background_update' ? 'background' : op.kind === 'defaults_update' ? 'defaults' : op.kind === 'series_add' ? op.series.id : op.id))];
    const entry = { before, after, beforeSettings, afterSettings, actor: batch.actor, targets };
    this.undoStack.push(entry);
    this.redoStack = [];
    this.commit(after, before, 'batch', batch.actor, targets, afterSettings);
    return result();
  }
  undo(actor = 'human') {
    const entry = this.undoStack.pop();
    if (!entry) throw new Error('Nothing to undo');
    this.redoStack.push(entry);
    if(entry.replacement){this.documentGeneration=randomUuid();this.filePath=null;this.fileNameHint='';this.selection=[];this.aiPointing=[];}
    this.commit(entry.before, this.objects, 'undo', actor, entry.targets, entry.beforeSettings);
    return this.summary();
  }
  redo(actor = 'human') {
    const entry = this.redoStack.pop();
    if (!entry) throw new Error('Nothing to redo');
    this.undoStack.push(entry);
    if(entry.replacement){this.documentGeneration=randomUuid();this.filePath=null;this.fileNameHint='';this.selection=[];this.aiPointing=[];}
    this.commit(entry.after, this.objects, 'redo', actor, entry.targets, entry.afterSettings);
    return this.summary();
  }
  private commit(after: Snapshot, before: Snapshot, operation: Change['operation'], actor: string, targets: string[], settings: Settings) {
    const settingsChange = JSON.stringify(this.settings) === JSON.stringify(settings) ? undefined
      : { before: this.settingsSnapshot(), after: structuredClone(settings) };
    this.settings = structuredClone(settings);
    const oldMap = new Map(before.map((o, i) => [o.id, { object: o, index: i }]));
    const newMap = new Map(after.map((o, i) => [o.id, { object: o, index: i }]));
    const details = [...new Set([...oldMap.keys(), ...newMap.keys()])].flatMap(id => {
      const old = oldMap.get(id), next = newMap.get(id);
      if (JSON.stringify(old) === JSON.stringify(next)) return [];
      return [{ id, before: old?.object, after: next?.object, beforeIndex: old?.index, afterIndex: next?.index }];
    });
    this.objects = structuredClone(after);
    this.selection = this.selection.filter(id => newMap.has(id));
    this.aiPointing = this.aiPointing.filter(id => newMap.has(id));
    this.changes.push(structuredClone({ revision: ++this.revision, operation, actor,
      timestamp: new Date().toISOString(), targets, details, ...(settingsChange ? { settings: settingsChange } : {}) }));
  }
}

export const requestSchema = z.discriminatedUnion('method', [
  z.object({ method: z.literal('summary') }),
  z.object({ method: z.literal('share_read'), tool: z.enum(['desk_context', 'desk_get', 'desk_asset_read']),
    expectedSessionId: z.string().uuid(), id: z.string().min(1).max(100).optional() }).strict(),
  z.object({ method: z.literal('list') }),
  z.object({ method: z.literal('get'), id: z.string() }),
  z.object({ method: z.literal('state') }),
  z.object({method:z.literal('pin_fit'),...pinFitFields}).strict(),
  z.object({method:z.literal('raster'),...captureFields}).strict(),
  z.object({method:z.literal('pdf_export'),...pdfExportFields}).strict(),
  z.object({ method: z.literal('mermaid_render'), id: z.string() }).strict(),
  z.object({method:z.literal('qr_render'),id:z.string()}).strict(),
  z.object({ method: z.literal('file_snapshot'), includeGeneration:z.literal(true).optional() }).strict(),
  z.object({ method: z.literal('file_saved'), expectedSessionId:z.string().uuid(), expectedRevision:z.number().int().nonnegative(), expectedGeneration:z.string().uuid().optional(),filePath:z.string().max(4096).optional() }).strict(),
  z.object({ method: z.literal('load_document'), document: z.unknown(), confirm: z.literal(true), filePath:z.string().max(4096).optional(),
    expectedSessionId: z.string().uuid(), expectedRevision: z.number().int().nonnegative(),
    actor: z.string().min(1).max(100).default('agent-01') }).strict(),
  z.object({ method: z.literal('context'), sinceRevision: z.number().int().nonnegative().default(0), limit: z.number().int().min(1).max(200).default(100) }),
  z.object({ method: z.literal('settings') }),
  z.object({ method: z.literal('selection') }),
  z.object({ method: z.literal('select'), ids: z.array(z.string()).max(2000) }),
  z.object({ method: z.literal('point'), ids: z.array(z.string()).max(2000) }),
  z.object({ method: z.literal('lock'), ...lockFields }).strict(),
  z.object({ method: z.literal('fit'), ...cameraAnimationFields }).strict(),
  z.object({ method: z.literal('ui_get') }).strict(),
  z.object({ method: z.literal('ui_set'), theme: z.enum(['light', 'dark']) }).strict(),
  z.object({ method: z.literal('camera_get') }).strict(),
  z.object({ method: z.literal('text_measure'), ...textMeasureFields }).strict(),
  z.object({ method: z.literal('camera_move'), ...cameraMoveFields }).strict(),
  z.object({ method:z.literal('wayfinder_start'),...wayfinderStartFields }).strict(),
  z.object({ method: z.literal('changes'), sinceRevision: z.number().int().nonnegative(), limit: z.number().int().min(1).max(200).default(100) }),
  z.object({ method: z.literal('execute'), ...mcpBatchSchema.shape }),
  z.object({ method: z.literal('undo'), actor: z.string().min(1).max(100).default('agent-01') }),
  z.object({ method: z.literal('redo'), actor: z.string().min(1).max(100).default('agent-01') }),
]);
export type Request = z.input<typeof requestSchema>;
export function dispatch(desk: Desk, input: unknown, camera?: CameraBridge, textMeasure?: TextMeasureBridge, ui?: { get(): { theme: 'light' | 'dark' }; set(theme: 'light' | 'dark'): { theme: 'light' | 'dark' } }, mermaid?: (source: string) => Promise<{ svg: string }>, raster?: (scale: number) => Promise<unknown>, qr?: (text:string)=>Promise<{svg:string;status:string}>,extra?:{pdf?:()=>Promise<unknown>;capture?:(input:CaptureInput)=>Promise<unknown>;pinFit?:(input:{seriesIds:string[];expectedRevision?:number;actor:string})=>unknown}): unknown {
  const request = requestSchema.parse(input);
  switch (request.method) {
    case 'pin_fit': {
      if(!extra?.pinFit)throw new Error('Pin fitting requires a compatible browser');
      return extra.pinFit(request);
    }
    case 'pdf_export': {
      if(request.expectedRevision!==undefined&&request.expectedRevision!==desk.revision)throw new Error('Revision conflict; read the desk again');
      if(!extra?.pdf)throw new Error('PDF export requires a compatible browser');
      return extra.pdf();
    }
    case 'raster': {
      if(request.expectedRevision!==undefined&&request.expectedRevision!==desk.revision)throw new Error('Revision conflict; read the desk again');
      if(request.ids||request.bounds){if(!extra?.capture)throw new Error('Region raster requires a compatible browser');return extra.capture(request);}
      if (!raster) throw new Error('Raster capture requires a compatible browser');
      return raster(request.scale);
    }
    case 'share_read': return shareRead(desk, request.tool, request.expectedSessionId, request.id);
    case 'qr_render': {
      const object=desk.get(request.id);if((object.type!=='qrcode'&&!(object.type==='link'&&!object.deskPath&&object.linkDisplay==='qr'))||!qr)throw new Error('QR rendering requires a compatible browser and QR object');
      const source=object.type==='qrcode'?object.qrText??'':object.url??'';
      const stamp={id:object.id,revision:desk.revision,qrText:source};
      return qr(source).then(({svg,status})=>({...stamp,svg,status}));
    }
    case 'mermaid_render': {
      const object = desk.get(request.id);
      if (object.type !== 'mermaid' || !mermaid) throw new Error('Mermaid rendering requires a compatible browser and Mermaid object');
      const stamp = { id: object.id, revision: desk.revision, mermaidSource: object.mermaidSource };
      return mermaid(object.mermaidSource ?? '').then(({ svg }) => ({ ...stamp, svg }));
    }
    case 'summary': return desk.summary();
    case 'ui_get':
      if (!ui) throw new Error('UI controls require a compatible browser');
      return ui.get();
    case 'ui_set':
      if (!ui) throw new Error('UI controls require a compatible browser');
      return ui.set(request.theme);
    case 'text_measure': {
      if (!textMeasure) throw new Error('Text measurement requires a compatible browser');
      return textMeasure(request.ids);
    }
    case 'list': return { ...desk.summary(), objects: desk.list() };
    case 'get': {
      const object = desk.get(request.id);
      return { ...publishObject(object), ...desk.imageGeometry.describe(object) };
    }
    case 'state': return { ...desk.summary(), objects: desk.snapshot().map(publishObject), selection: desk.selected(), aiPointing: desk.pointed(), settings: desk.settingsSnapshot() };
    case 'file_snapshot': {
      const snapshot = { sessionId: desk.sessionId, revision: desk.revision, ...(request.includeGeneration?{generation:desk.documentGeneration}:{}), objects: desk.snapshot(), settings: desk.settingsSnapshot() };
      checkDeskBridgeSize(snapshot);
      return snapshot;
    }
    case 'file_saved': {
      if(request.expectedSessionId!==desk.sessionId||(request.expectedGeneration&&request.expectedGeneration!==desk.documentGeneration))return {marked:false};
      const marked=desk.markSaved(request.expectedRevision);
      if(request.filePath&&(marked||request.expectedGeneration))desk.filePath=request.filePath;
      return {marked};
    }
    case 'load_document': {
      if (request.expectedSessionId !== desk.sessionId || request.expectedRevision !== desk.revision) throw new Error('Session or revision conflict: refresh before loading');
      checkDeskBridgeSize(request);
      const result=desk.replaceDocument(request.document, request.actor);
      desk.filePath=request.filePath??null;return result;
    }
    case 'settings': return desk.listSettings();
    case 'context': return { ...deskContext(desk, request.sinceRevision, request.limit), ...(ui ? { ui: ui.get() } : {}) };
    case 'selection': return { ids: desk.selected(), aiPointing: desk.pointed(), pointer: desk.pointer };
    case 'select': return desk.select(request.ids);
    case 'point': return desk.point(request.ids);
    case 'lock': {
      if (request.expectedRevision !== undefined && request.expectedRevision !== desk.revision) throw new Error('Revision conflict: refresh before editing');
      const scene = desk.snapshot();
      const ids = [...new Set(desk.pointed().flatMap(id => fileGroup(scene, id).map(object => object.id)))];
      const operations = lockOperations(ids.map(id => desk.get(id)), request.locked);
      const result = operations.length ? desk.execute({ operations, actor: request.actor, expectedRevision: request.expectedRevision }) : desk.summary();
      return { ...result, ids, locked: request.locked };
    }
    case 'fit': return { ids: desk.pointed() };
    case 'camera_get': {
      if (!camera) throw new Error('Camera controls unavailable');
      return camera.get();
    }
    case 'camera_move': {
      if (!camera) throw new Error('Camera controls unavailable');
      const { method: _method, ...move } = request;
      return camera.move(cameraMoveSchema.parse(move));
    }
    case 'wayfinder_start': {
      if(!camera?.wayfinderStart)throw new Error('Wayfinder controls unavailable; update the browser after saving the desk');
      const {method:_method,...start}=request;return camera.wayfinderStart(wayfinderStartSchema.parse(start));
    }
    case 'changes': return desk.getChanges(request.sinceRevision, request.limit);
    case 'execute': {
      const { method: _method, ...batch } = request;
      return desk.execute(batch);
    }
    case 'undo': return desk.undo(request.actor);
    case 'redo': return desk.redo(request.actor);
  }
}
