import type { DeskObject } from './model';
import type { Point } from './geometry';
import type { GridSettings } from './grid-settings';

export const gridInterval = 24;
const defaultGrid: GridSettings = { enabled: true, interval: gridInterval, origin: { x: 0, y: 0 } };
export function gridPoint(point: Point, grid: GridSettings = defaultGrid): Point {
  return { x: grid.origin.x + Math.round((point.x - grid.origin.x) / grid.interval) * grid.interval,
    y: grid.origin.y + Math.round((point.y - grid.origin.y) / grid.interval) * grid.interval };
}
export function gridOrigin(object: DeskObject): Point {
  return object.type === 'label' ? { x: object.x + object.width / 2, y: object.y + object.height }
    : { x: object.x, y: object.y };
}
export function gridMoveDelta(object: DeskObject, delta: Point, grid: GridSettings = defaultGrid): Point {
  const origin = gridOrigin(object);
  const point = gridPoint({ x: origin.x + delta.x, y: origin.y + delta.y }, grid);
  return { x: point.x - origin.x, y: point.y - origin.y };
}
