import type { DeskObject } from './model';
import { anchorPoint, isConnectable, type Anchor, type Point } from './geometry';

const center = (object: DeskObject): Point => ({ x: object.x + object.width / 2, y: object.y + object.height / 2 });
/** Choose the side crossed by a ray from the frame center toward the other center. */
export function facingAnchor(object: DeskObject, toward: Point, fallback: Anchor = 'right'): Anchor {
  const origin = center(object), dx = toward.x - origin.x, dy = toward.y - origin.y;
  if (!dx && !dy) return fallback;
  return Math.abs(dx) * object.height >= Math.abs(dy) * object.width
    ? dx >= 0 ? 'right' : 'left' : dy >= 0 ? 'bottom' : 'top';
}

export function selectedConnection(selected: DeskObject[]): Partial<DeskObject> {
  const targets = selected.filter(isConnectable);
  if (targets.length < 1 || targets.length > 2) return {};
  const [source, target] = targets;
  const startAnchor = target ? facingAnchor(source, center(target)) : 'right';
  const endAnchor = target ? facingAnchor(target, center(source), 'left') : undefined;
  const start = anchorPoint(source, startAnchor);
  const end = target && endAnchor ? anchorPoint(target, endAnchor) : { x: start.x + 120, y: start.y };
  return { x: start.x, y: start.y, x2: end.x, y2: end.y,
    startBinding: { objectId: source.id, anchor: startAnchor },
    endBinding: target && endAnchor ? { objectId: target.id, anchor: endAnchor } : null };
}
