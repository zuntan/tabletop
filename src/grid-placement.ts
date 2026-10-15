import type { Batch, DeskObject, Operation } from './model';
import type { Settings } from './settings';
import type { GridSettings } from './grid-settings';
import { endpoints, isConnector } from './geometry';
import { gridMoveDelta, gridOrigin, gridPoint } from './grid';

const fields = ['x', 'y', 'x2', 'y2', 'width', 'height'] as const;
export function placementGeometry(object: DeskObject) {
  const points = isConnector(object) ? endpoints(object) : undefined;
  return { x: points?.start.x ?? object.x, y: points?.start.y ?? object.y,
    ...(points ? { x2: points.end.x, y2: points.end.y } : {}), width: object.width, height: object.height };
}
function moveInfo(operation: Operation, scene: DeskObject[]) {
  if (operation.kind !== 'update' || operation.patch.x === undefined || operation.patch.y === undefined
    || Object.keys(operation.patch).some(key => !['x', 'y', 'x2', 'y2', 'startBinding', 'endBinding'].includes(key))) return null;
  const object = scene.find(item => item.id === operation.id);
  if (!object) return null;
  const delta = { x: operation.patch.x - object.x, y: operation.patch.y - object.y };
  if (isConnector(object)) {
    const next = { ...object, ...operation.patch }, points = endpoints(object);
    if (next.startBinding || next.endBinding || operation.patch.x2 === undefined || operation.patch.y2 === undefined
      || Math.abs(operation.patch.x2 - points.end.x - delta.x) > 1e-9
      || Math.abs(operation.patch.y2 - points.end.y - delta.y) > 1e-9) return null;
  }
  return { object, delta };
}

/** Normalize placement only at the public MCP boundary; UI numeric edits and committed Undo data stay exact. */
export function createGridPlacement(batch: Batch, before: DeskObject[], parseObject: (input: unknown) => DeskObject) {
  const mode = batch.snap ?? 'exact';
  const moves = batch.operations.map(operation => moveInfo(operation, before));
  const first = moves[0];
  const group = first && moves.every(move => move && Math.abs(move.delta.x - first.delta.x) < 1e-9
    && Math.abs(move.delta.y - first.delta.y) < 1e-9) ? moves.filter(move => move !== null) : [];
  const anchor = batch.snapAnchorId ? group.find(move => move.object.id === batch.snapAnchorId) : group[0];
  if (batch.snapAnchorId && !anchor) throw new Error('snapAnchorId requires a position-only move batch with one common delta');
  const results: { id: string; requested: ReturnType<typeof placementGeometry>; snapped: boolean; grid: GridSettings }[] = [];
  function normalize(operation: Operation, scene: DeskObject[], settings: Settings): Operation {
    let requested: DeskObject;
    if (operation.kind === 'add') requested = parseObject(operation.object);
    else if (operation.kind === 'label_add') {
      const series = settings.series.find(item => item.id === operation.seriesId);
      if (!series) throw new Error(`Unknown series: ${operation.seriesId}`);
      const { name: _name, format: _format, shape: _shape, id: _id, ...appearance } = series;
      requested = parseObject({ ...appearance, id: operation.id, type: 'label', x: operation.x, y: operation.y });
    } else if (operation.kind === 'update' && fields.some(field => operation.patch[field] !== undefined)) {
      const object = scene.find(item => item.id === operation.id);
      if (!object) throw new Error(`Unknown object: ${operation.id}`);
      requested = { ...object, ...operation.patch };
    } else return operation;
    if ((requested.x2 === undefined) !== (requested.y2 === undefined)) throw new Error('Both x2 and y2 are required');
    const next = { ...requested }, grid = settings.grid;
    const active = mode === 'desk' && grid.enabled;
    if (active && operation.kind === 'update' && anchor && group.length) {
      const delta = gridMoveDelta(anchor.object, anchor.delta, grid);
      const correction = { x: delta.x - anchor.delta.x, y: delta.y - anchor.delta.y };
      next.x += correction.x; next.y += correction.y;
      if (isConnector(next)) { next.x2! += correction.x; next.y2! += correction.y; }
    } else if (active && isConnector(next)) {
      const points = endpoints(next);
      for (const side of ['start', 'end'] as const) {
        const binding = side === 'start' ? next.startBinding : next.endBinding;
        const changing = operation.kind === 'add' || (operation.kind === 'update' && (side === 'start'
          ? operation.patch.x !== undefined || operation.patch.y !== undefined || operation.patch.width !== undefined || operation.patch.height !== undefined
          : operation.patch.x2 !== undefined || operation.patch.y2 !== undefined || operation.patch.width !== undefined || operation.patch.height !== undefined));
        if (!binding && changing) {
          const point = gridPoint(points[side], grid);
          if (operation.kind === 'update' && next.x2 !== undefined) {
            const x = side === 'start' ? operation.patch.x : operation.patch.x2;
            const y = side === 'start' ? operation.patch.y : operation.patch.y2;
            points[side] = { x: x === undefined ? points[side].x : point.x, y: y === undefined ? points[side].y : point.y };
          } else points[side] = point;
        }
      }
      Object.assign(next, { x: points.start.x, y: points.start.y, x2: points.end.x, y2: points.end.y });
    } else if (active) {
      const origin = gridOrigin(next), point = gridPoint(origin, grid);
      if (operation.kind !== 'update' || operation.patch.x !== undefined) next.x += point.x - origin.x;
      if (operation.kind !== 'update' || operation.patch.y !== undefined) next.y += point.y - origin.y;
      if (operation.kind === 'update') {
        const corner = gridPoint({ x: next.x + next.width, y: next.y + next.height }, grid);
        if (operation.patch.width !== undefined) next.width = Math.max(1, corner.x - next.x);
        if (operation.patch.height !== undefined) next.height = Math.max(1, corner.y - next.y);
      }
    }
    const input = placementGeometry(requested), output = placementGeometry(next);
    const snapped = fields.some(field => input[field as keyof typeof input] !== output[field as keyof typeof output]);
    results.push({ id: requested.id, requested: input, snapped, grid: structuredClone(grid) });
    if (operation.kind === 'add') return { ...operation, object: { ...operation.object, ...output } };
    if (operation.kind === 'label_add') return { ...operation, x: next.x, y: next.y };
    if (operation.kind !== 'update') return operation;
    const patch = { ...operation.patch };
    for (const field of fields) if (next[field] !== requested[field]) patch[field] = next[field];
    return { ...operation, patch };
  }
  return { normalize, results, mode };
}
