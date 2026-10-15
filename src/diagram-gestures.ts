import type { DeskObject, Operation } from './model';
import { endpoints, isConnector, resolveConnections, snap, type Point } from './geometry';
import { gridPoint, gridMoveDelta } from './grid';
import type { GridSettings } from './grid-settings';

export type Gesture = {
  mode: 'move' | 'resize' | 'start' | 'end' | 'pan' | 'marquee';
  start: Point;
  screen: Point;
  originals: DeskObject[];
  scene: DeskObject[];
  preview: DeskObject[];
  revision: number;
  camera: Point;
  additive: string[];
  grid?: boolean;
  gridSettings?: GridSettings;
  anchorId?: string;
};
export function gestureOperations(gesture: Gesture, point: Point, zoom: number): Operation[] {
  let dx = point.x - gesture.start.x, dy = point.y - gesture.start.y;
  if (dx === 0 && dy === 0) return []; // Selecting a connected line must not detach it.
  const anchor = gesture.originals.find(object => object.id === gesture.anchorId) ?? gesture.originals[0];
  if (gesture.grid && gesture.mode === 'move' && anchor) {
    const delta = gridMoveDelta(anchor, { x: dx, y: dy }, gesture.gridSettings); dx = delta.x; dy = delta.y;
    if (dx === 0 && dy === 0) return [];
  }
  return gesture.originals.map(object => {
    let patch: Partial<DeskObject>;
    if (gesture.mode === 'start' || gesture.mode === 'end') {
      const points = endpoints(object), side = gesture.mode;
      const next = { x: points[side].x + dx, y: points[side].y + dy };
      const candidate = snap(next, gesture.scene, 18 / zoom);
      const p = candidate?.point ?? (gesture.grid ? gridPoint(next, gesture.gridSettings) : next);
      patch = side === 'start' ? { x: p.x, y: p.y, startBinding: candidate?.binding ?? null }
        : { x2: p.x, y2: p.y, endBinding: candidate?.binding ?? null };
    } else if (gesture.mode === 'resize') {
      const corner = { x: object.x + object.width + dx, y: object.y + object.height + dy };
      const next = gesture.grid ? gridPoint(corner, gesture.gridSettings) : corner;
      patch = { width: Math.max(1, next.x - object.x), height: Math.max(1, next.y - object.y) };
    } else if (isConnector(object)) {
      const { start, end } = endpoints(object);
      patch = { x: start.x + dx, y: start.y + dy, x2: end.x + dx, y2: end.y + dy, startBinding: null, endBinding: null };
    } else {
      patch = { x: object.x + dx, y: object.y + dy };
    }
    return { kind: 'update', id: object.id, patch };
  });
}
export function gesturePreview(gesture: Gesture, point: Point, zoom: number): DeskObject[] {
  const operations = gestureOperations(gesture, point, zoom);
  const updates = new Map(operations.flatMap(op => op.kind === 'update' ? [[op.id, op.patch] as const] : []));
  return resolveConnections(gesture.scene.map(o => ({ ...o, ...updates.get(o.id) })), gesture.scene);
}
export function endpointDragPoint(gesture: Gesture, point: Point): Point {
  const side = gesture.mode === 'start' ? 'start' : 'end';
  const initial = endpoints(gesture.originals[0])[side];
  return { x: initial.x + point.x - gesture.start.x, y: initial.y + point.y - gesture.start.y };
}
