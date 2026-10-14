import type { DeskObject } from './model';

export type Point = { x: number; y: number };
export type Anchor = 'top' | 'right' | 'bottom' | 'left';
export type Binding = { objectId: string; anchor: Anchor };
export const anchors: Anchor[] = ['top', 'right', 'bottom', 'left'];
export const isConnector = (object: DeskObject) => object.type === 'line' || object.type === 'arrow';
export const isShape = (object: DeskObject) => object.type === 'rect' || object.type === 'roundedRect'
  || object.type === 'ellipse' || (object.type === 'label' && object.labelShape !== 'text');
export const isConnectable = (object: DeskObject) => isShape(object) || object.type === 'label' || object.type === 'text';

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
  if (!isConnector(object)) return { x: object.x, y: object.y, width: object.width, height: object.height };
  const { start, end } = endpoints(object);
  return { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
}
export function anchorPoint(object: DeskObject, anchor: Anchor): Point {
  switch (anchor) {
    case 'top': return { x: object.x + object.width / 2, y: object.y };
    case 'right': return { x: object.x + object.width, y: object.y + object.height / 2 };
    case 'bottom': return { x: object.x + object.width / 2, y: object.y + object.height };
    case 'left': return { x: object.x, y: object.y + object.height / 2 };
  }
}
export function snap(point: Point, objects: DeskObject[], threshold: number) {
  let closest: { point: Point; binding: Binding } | null = null;
  let distance = threshold;
  // Favor the frontmost object when two anchors coincide.
  for (const object of objects.slice().reverse()) {
    if (!isConnectable(object)) continue;
    for (const anchor of anchors) {
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
export function resolveConnections(objects: DeskObject[], before: DeskObject[] = []): DeskObject[] {
  const map = new Map(objects.map(o => [o.id, o]));
  const previous = new Map(before.map(o => [o.id, o]));
  return objects.map(object => {
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
      if (!target || (!isConnectable(target) && isConnectable(previous.get(binding.objectId) ?? target))) {
        const oldBinding = previous.get(object.id)?.[field];
        if (oldBinding?.objectId !== binding.objectId || oldBinding.anchor !== binding.anchor || !previous.has(binding.objectId)) {
          throw new Error(`Unknown connection target: ${binding.objectId}`);
        }
        next[field] = null; // Target removed or no longer a shape: keep the cached endpoint.
      } else {
        if (!isConnectable(target)) throw new Error('Connections require a connectable shape');
        points[side] = anchorPoint(target, binding.anchor);
      }
    }
    return withEndpoints(next, points.start, points.end);
  });
}
