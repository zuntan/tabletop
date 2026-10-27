import {resolveRulers} from './ruler-layout';
import {resolveFiles,freezeFileGeometry} from './clear-files';
import { resolveClips, clipFollower } from './clip-bundles';
import { isShapeType, isNewShape } from './shape-definitions';
import { resolveTextCallouts } from './text-callouts';
import { resolvePinAttachments } from './pin-attachments';
import { resolveJunctions } from './connector-junctions';
import type { DeskObject } from './model';

export type Point = { x: number; y: number };
export const anchorNames = ['top', 'right', 'bottom', 'left', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'] as const;
export type Anchor = typeof anchorNames[number];
export type Binding = { objectId: string; anchor: Anchor };
export const anchors: readonly Anchor[] = anchorNames.slice(0, 8);
export function anchorsFor(object: DeskObject, scene: DeskObject[] = []): readonly Anchor[] {
  if (['clip','file','ruler'].includes(object.type) || clipFollower(scene,object.id)) return [];
  if (object.type === 'prop') return [];
  if(object.type==='wayfinder')return ['top','right','left'];
  return object.type === 'label' ? ['center'] : isNewShape(object.type) ? ['top', 'right', 'bottom', 'left'] : anchors;
}
export const isConnector = (object: DeskObject) => object.type === 'line';
export const isShape = (object: DeskObject) => isShapeType(object.type) || (object.type === 'label' && object.labelShape !== 'text');
export const isConnectable = (object: DeskObject, scene: DeskObject[] = []) => !clipFollower(scene,object.id) && (isShape(object) || object.type === 'label' || object.type === 'text' || ['image', 'svg', 'mermaid','web','link','wayfinder'].includes(object.type));

export function endpoints(object: DeskObject): { start: Point; end: Point } {
  if (object.x2 !== undefined && object.y2 !== undefined) {
    return { start: { x: object.x, y: object.y }, end: { x: object.x2, y: object.y2 } };
  }
  // Legacy geometry: lower-left to upper-right of its bounding rectangle.
  return { start: { x: object.x, y: object.y + object.height }, end: { x: object.x + object.width, y: object.y } };
}
export function withEndpoints(object: DeskObject, start: Point, end: Point): DeskObject {
  return { ...object, x: start.x, y: start.y, x2: end.x, y2: end.y,
    width: Math.max(1, Math.abs(end.x - start.x)), height: Math.max(1, Math.abs(end.y - start.y)) };
}
export function bounds(object: DeskObject) {
  if (!isConnector(object)) {
    const tip = object.cutout?.enabled ? undefined : object.callout;
    const x = Math.min(object.x, tip?.x ?? object.x), y = Math.min(object.y, tip?.y ?? object.y);
    return { x, y, width: Math.max(object.x + object.width, tip?.x ?? object.x) - x,
      height: Math.max(object.y + object.height, tip?.y ?? object.y) - y };
  }
  const { start, end } = endpoints(object);
  return { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
}
export function anchorPoint(object: DeskObject, anchor: Anchor): Point {
  if (['prop','clip','file'].includes(object.type)) throw new Error('Props and clips have no anchors');
  if (isNewShape(object.type) && !['top', 'right', 'bottom', 'left'].includes(anchor))
    throw new Error('This shape supports only top/right/bottom/left anchors');
  switch (anchor) {
    case 'top': return { x: object.x + object.width / 2, y: object.y };
    case 'right': return { x: object.x + object.width, y: object.y + object.height / 2 };
    case 'bottom': return { x: object.x + object.width / 2, y: object.y + object.height };
    case 'left': return { x: object.x, y: object.y + object.height / 2 };
    case 'center': return { x: object.x + object.width / 2, y: object.y + object.height / 2 };
    default: {
      const shape = object.type === 'label' ? object.labelShape : object.type;
      const curved = shape === 'ellipse';
      const radius = shape === 'roundedRect' || object.type === 'text'
        ? Math.min(object.cornerRadius, object.width / 2, object.height / 2) : 0;
      const inset = 1 - Math.SQRT1_2;
      const dx = curved ? object.width / 2 * inset : radius * inset;
      const dy = curved ? object.height / 2 * inset : radius * inset;
      return { x: object.x + (anchor.endsWith('left') ? dx : object.width - dx),
        y: object.y + (anchor.startsWith('top') ? dy : object.height - dy) };
    }
  }
}
export function snap(point: Point, objects: DeskObject[], threshold: number) {
  let closest: { point: Point; binding: Binding } | null = null;
  let distance = threshold;
  // Favor the frontmost object when two anchors coincide.
  for (const object of objects.slice().reverse()) {
    if (!isConnectable(object,objects)) continue;
    for (const anchor of anchorsFor(object,objects)) {
      const candidate = anchorPoint(object, anchor);
      const d = Math.hypot(candidate.x - point.x, candidate.y - point.y);
      if (d <= distance && (!closest || d < distance)) {
        distance = d; closest = { point: candidate, binding: { objectId: object.id, anchor } };
      }
    }
  }
  return closest;
}

/** Resolve after the entire atomic batch, allowing forward references inside it. */
export function resolveConnections(objects: DeskObject[], before: DeskObject[] = [], freeze=true): DeskObject[] {
  objects = resolveFiles(objects,before);
  const fixed=objects;
  objects = resolveRulers(resolveClips(objects,before),before);
  objects = resolvePinAttachments(objects, before);
  objects = resolveTextCallouts(objects, before);
  const map = new Map(objects.map(o => [o.id, o]));
  const previous = new Map(before.map(o => [o.id, o]));
  const wayfinderPorts=new Map<string,number>();
  const resolved = objects.map(object => {
    if (!isConnector(object)) {
      if (object.x2 !== undefined || object.y2 !== undefined || object.startBinding || object.endBinding) {
        throw new Error('Endpoints and bindings are only supported on lines and arrows');
      }
      return object;
    }
    if ((object.x2 === undefined) !== (object.y2 === undefined)) throw new Error('Both x2 and y2 are required');
    const points = endpoints(object);
    const next = { ...object };
    for (const [side, field] of [['start', 'startBinding'], ['end', 'endBinding']] as const) {
      const binding = object[field];
      if (!binding) continue;
      const target = map.get(binding.objectId);
      if (!target || (!isConnectable(target,objects) && isConnectable(previous.get(binding.objectId) ?? target,before))) {
        const oldBinding = previous.get(object.id)?.[field];
        if (oldBinding?.objectId !== binding.objectId || oldBinding.anchor !== binding.anchor || !previous.has(binding.objectId)) {
          throw new Error(`Unknown connection target: ${binding.objectId}`);
        }
        next[field] = null; // Target removed or no longer a shape: keep the cached endpoint.
      } else {
        if (!isConnectable(target,objects)) throw new Error('Connections require a connectable shape');
        if(target.type==='wayfinder'){
          if(!['top','right','left'].includes(binding.anchor))throw new Error('道しるべの下は対象への取り付け専用です。線は上・左・右へ接続してください');
          const count=(wayfinderPorts.get(target.id)??0)+1;wayfinderPorts.set(target.id,count);
          if(count>1)throw new Error('初版の道しるべに接続できる経路線は1本だけです');
        }
        points[side] = anchorPoint(target, binding.anchor);
      }
    }
    return withEndpoints(next, points.start, points.end);
  });
  const joined=resolveJunctions(resolved,before);
  if(freeze){const frozen=freezeFileGeometry(joined,fixed);if(frozen.changed)return resolveConnections(frozen.objects,before,false);}
  return resolveFiles(joined,before);
}
