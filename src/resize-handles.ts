import type { DeskObject } from './model';
import type { Point } from './geometry';
import { gridPoint } from './grid';
import type { GridSettings } from './grid-settings';

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const positions: Record<ResizeHandle, [number, number]> = {
  nw: [0, 0], n: [.5, 0], ne: [1, 0], e: [1, .5],
  se: [1, 1], s: [.5, 1], sw: [0, 1], w: [0, .5],
};
/** Screen-space threshold keeps the ten-pixel handles separated at low zoom. */
export function resizeHandles(object: Pick<DeskObject, 'x' | 'y' | 'width' | 'height'>, zoom: number) {
  const names: ResizeHandle[] = object.width * zoom >= 72 && object.height * zoom >= 72
    ? ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] : ['se'];
  return names.map(handle => ({ handle, x: object.x + object.width * positions[handle][0],
    y: object.y + object.height * positions[handle][1] }));
}

export function resizePatch(object: DeskObject, handle: ResizeHandle, delta: Point, grid?: GridSettings | boolean): Partial<DeskObject> {
  const west = handle.includes('w'), east = handle.includes('e');
  const north = handle.includes('n'), south = handle.includes('s');
  const point = { x: object.x + (west ? 0 : object.width) + delta.x,
    y: object.y + (north ? 0 : object.height) + delta.y };
  const next = grid === false || grid === undefined ? point : gridPoint(point, grid === true ? undefined : grid);
  let width = west ? Math.max(1, object.x + object.width - next.x) : east ? Math.max(1, next.x - object.x) : object.width;
  let height = north ? Math.max(1, object.y + object.height - next.y) : south ? Math.max(1, next.y - object.y) : object.height;
  // Match the existing ruler normalization before anchoring its opposite edge.
  if (object.type === 'ruler') {
    const vertical = (handle === 'n' || handle === 's') && object.rulerAxis === 'vertical' ? true
      : (handle === 'w' || handle === 'e') && object.rulerAxis === 'horizontal' ? false
      : width === height ? object.rulerAxis === 'vertical' : height > width;
    const thickness = object.rulerThickness ?? 36;
    if (vertical) { width = thickness; height = Math.max(120, thickness + 1, height); }
    else { width = Math.max(120, thickness + 1, width); height = thickness; }
  }
  return { ...(west ? { x: object.x + object.width - width } : {}),
    ...(north ? { y: object.y + object.height - height } : {}),
    ...(west || east || width !== object.width ? { width } : {}),
    ...(north || south || height !== object.height ? { height } : {}) };
}
