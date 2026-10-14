import type { DeskObject } from './model';
import type { Point } from './geometry';

export const gridInterval = 24;
export function gridPoint(point: Point): Point {
  return { x: Math.round(point.x / gridInterval) * gridInterval, y: Math.round(point.y / gridInterval) * gridInterval };
}
export function gridOrigin(object: DeskObject): Point {
  return object.type === 'label' ? { x: object.x + object.width / 2, y: object.y + object.height }
    : { x: object.x, y: object.y };
}
export function gridMoveDelta(object: DeskObject, delta: Point): Point {
  const origin = gridOrigin(object);
  const point = gridPoint({ x: origin.x + delta.x, y: origin.y + delta.y });
  return { x: point.x - origin.x, y: point.y - origin.y };
}
