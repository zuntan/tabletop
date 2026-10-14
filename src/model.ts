import { z } from 'zod';
import { resolveConnections } from './geometry';

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
  anchor: z.enum(['top', 'right', 'bottom', 'left']),
}).strict();

export const objectSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.enum(['rect', 'ellipse', 'line', 'arrow', 'text', 'image', 'svg', 'web', 'link']),
  x: coordinate.default(0),
  y: coordinate.default(0),
  x2: coordinate.optional(),
  y2: coordinate.optional(),
  startBinding: bindingSchema.nullable().optional(),
  endBinding: bindingSchema.nullable().optional(),
  width: dimension.default(180),
  height: dimension.default(100),
  fill: color.default('#dbeafe'),
  stroke: color.default('#334155'),
  strokeWidth: z.number().finite().min(0).max(100).default(2),
  text: z.string().max(100_000).default(''),
  textColor: color.default('#0f172a'),
  fontSize: z.number().finite().min(1).max(1000).default(24),
  src: source.optional(),
  url: z.string().max(4096).refine(safeUrl, 'Expected an HTTP(S) URL').optional(),
}).strict();

export const patchSchema = objectSchema.omit({ id: true, type: true }).partial();
export const operationSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('add'), object: objectSchema }).strict(),
  z.object({ kind: z.literal('update'), id: z.string(), patch: patchSchema }).strict(),
  z.object({ kind: z.literal('delete'), id: z.string() }).strict(),
  z.object({ kind: z.literal('reorder'), id: z.string(), index: z.number().int().min(0) }).strict(),
]);
export const batchSchema = z.object({
  operations: z.array(operationSchema).min(1).max(200),
  actor: z.string().min(1).max(100).default('agent-01'),
  expectedRevision: z.number().int().nonnegative().optional(),
}).strict();

export type DeskObject = z.infer<typeof objectSchema>;
export type Operation = z.infer<typeof operationSchema>;
export type Batch = z.input<typeof batchSchema>;
export type Change = {
  revision: number;
  operation: 'batch' | 'undo' | 'redo';
  actor: string;
  timestamp: string;
  targets: string[];
  details: { id: string; before?: DeskObject; after?: DeskObject; beforeIndex?: number; afterIndex?: number }[];
};
type Snapshot = DeskObject[];
type Entry = { before: Snapshot; after: Snapshot; actor: string; targets: string[] };

function validateObject(object: unknown): DeskObject {
  const parsed = objectSchema.parse(object);
  if (['image', 'svg'].includes(parsed.type) && !parsed.src) throw new Error('Image source required');
  if (['web', 'link'].includes(parsed.type) && !parsed.url) throw new Error('URL required');
  return parsed;
}

/** The sole committed state writer for both UI and MCP operations. */
export class Desk {
  readonly sessionId = crypto.randomUUID();
  revision = 0;
  private objects: Snapshot = [];
  private undoStack: Entry[] = [];
  private redoStack: Entry[] = [];
  private changes: Change[] = [];
  private selection: string[] = [];
  pointer: { x: number; y: number } | null = null;

  snapshot(): Snapshot { return structuredClone(this.objects); }
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
    return { sessionId: this.sessionId, revision: this.revision, count: this.objects.length,
      types, canUndo: this.undoStack.length > 0, canRedo: this.redoStack.length > 0 };
  }
  list() {
    return this.objects.map(({ src, ...object }, zIndex) => ({
      ...object, zIndex, ...(src ? { asset: { source: src.startsWith('data:') ? 'embedded' : src, length: src.length } } : {}),
    }));
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
    const { src, ...rest } = object;
    return { ...rest, ...(src ? { asset: { source: src.startsWith('data:') ? 'embedded' : src, length: src.length } } : {}) };
  }
  execute(input: Batch) {
    const batch = batchSchema.parse(input);
    if (batch.expectedRevision !== undefined && batch.expectedRevision !== this.revision) throw new Error('Revision conflict: refresh before editing');
    const before = this.snapshot();
    let after = this.snapshot();
    for (const operation of batch.operations) {
      if (operation.kind === 'add') {
        if (after.some(o => o.id === operation.object.id)) throw new Error(`Duplicate ID: ${operation.object.id}`);
        if (after.length >= 2000) throw new Error('Object limit reached');
        after.push(validateObject(operation.object));
        continue;
      }
      const index = after.findIndex(o => o.id === operation.id);
      if (index < 0) throw new Error(`Unknown object: ${operation.id}`);
      if (operation.kind === 'update') after[index] = validateObject({ ...after[index], ...operation.patch });
      if (operation.kind === 'delete') after.splice(index, 1);
      if (operation.kind === 'reorder') {
        const [object] = after.splice(index, 1);
        after.splice(Math.min(operation.index, after.length), 0, object);
      }
    }
    after = resolveConnections(after, before).map(validateObject);
    if (JSON.stringify(before) === JSON.stringify(after)) return this.summary();
    const targets = [...new Set(batch.operations.map(op => op.kind === 'add' ? op.object.id : op.id))];
    const entry = { before, after, actor: batch.actor, targets };
    this.undoStack.push(entry);
    this.redoStack = [];
    this.commit(after, before, 'batch', batch.actor, targets);
    return this.summary();
  }
  undo(actor = 'human') {
    const entry = this.undoStack.pop();
    if (!entry) throw new Error('Nothing to undo');
    this.redoStack.push(entry);
    this.commit(entry.before, this.objects, 'undo', actor, entry.targets);
    return this.summary();
  }
  redo(actor = 'human') {
    const entry = this.redoStack.pop();
    if (!entry) throw new Error('Nothing to redo');
    this.undoStack.push(entry);
    this.commit(entry.after, this.objects, 'redo', actor, entry.targets);
    return this.summary();
  }
  private commit(after: Snapshot, before: Snapshot, operation: Change['operation'], actor: string, targets: string[]) {
    const oldMap = new Map(before.map((o, i) => [o.id, { object: o, index: i }]));
    const newMap = new Map(after.map((o, i) => [o.id, { object: o, index: i }]));
    const details = [...new Set([...oldMap.keys(), ...newMap.keys()])].flatMap(id => {
      const old = oldMap.get(id), next = newMap.get(id);
      if (JSON.stringify(old) === JSON.stringify(next)) return [];
      return [{ id, before: old?.object, after: next?.object, beforeIndex: old?.index, afterIndex: next?.index }];
    });
    this.objects = structuredClone(after);
    this.selection = this.selection.filter(id => newMap.has(id));
    this.changes.push(structuredClone({ revision: ++this.revision, operation, actor,
      timestamp: new Date().toISOString(), targets, details }));
  }
}

export const requestSchema = z.discriminatedUnion('method', [
  z.object({ method: z.literal('summary') }),
  z.object({ method: z.literal('list') }),
  z.object({ method: z.literal('get'), id: z.string() }),
  z.object({ method: z.literal('state') }),
  z.object({ method: z.literal('selection') }),
  z.object({ method: z.literal('select'), ids: z.array(z.string()).max(2000) }),
  z.object({ method: z.literal('changes'), sinceRevision: z.number().int().nonnegative(), limit: z.number().int().min(1).max(200).default(100) }),
  z.object({ method: z.literal('execute'), ...batchSchema.shape }),
  z.object({ method: z.literal('undo'), actor: z.string().min(1).max(100).default('agent-01') }),
  z.object({ method: z.literal('redo'), actor: z.string().min(1).max(100).default('agent-01') }),
]);
export type Request = z.input<typeof requestSchema>;
export function dispatch(desk: Desk, input: unknown): unknown {
  const request = requestSchema.parse(input);
  switch (request.method) {
    case 'summary': return desk.summary();
    case 'list': return { ...desk.summary(), objects: desk.list() };
    case 'get': return desk.get(request.id);
    case 'state': return { ...desk.summary(), objects: desk.snapshot(), selection: desk.selected() };
    case 'selection': return { ids: desk.selected(), pointer: desk.pointer };
    case 'select': return desk.select(request.ids);
    case 'changes': return desk.getChanges(request.sinceRevision, request.limit);
    case 'execute': {
      const { method: _method, ...batch } = request;
      return desk.execute(batch);
    }
    case 'undo': return desk.undo(request.actor);
    case 'redo': return desk.redo(request.actor);
  }
}
