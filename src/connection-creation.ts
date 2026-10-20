import type { DeskObject } from './model';
import { anchorPoint, isConnectable, type Anchor, type Point } from './geometry';

const center = (object: DeskObject): Point => ({ x: object.x + object.width / 2, y: object.y + object.height / 2 });
/** Choose one of eight directions, normalized to the target's aspect ratio. */
export function facingAnchor(object: DeskObject, toward: Point, fallback: Anchor = 'right'): Anchor {
  if (object.type === 'label') return 'center';
  const origin = center(object), dx = toward.x - origin.x, dy = toward.y - origin.y;
  if (!dx && !dy) return fallback;
  const directions: Anchor[] = ['right', 'bottom-right', 'bottom', 'bottom-left', 'left', 'top-left', 'top', 'top-right'];
  const sector = Math.round(Math.atan2(dy / object.height, dx / object.width) / (Math.PI / 4));
  return directions[(sector + 8) % 8];
}

export function selectedConnection(selected: DeskObject[], scene: DeskObject[] = selected): Partial<DeskObject> {
  const targets = selected.filter(o=>isConnectable(o,scene));
  if (targets.length < 1 || targets.length > 2) return {};
  const [source, target] = targets;
  const startAnchor = target ? facingAnchor(source, center(target)) : source.type === 'label' ? 'center' : 'right';
  const endAnchor = target ? facingAnchor(target, center(source), 'left') : undefined;
  const start = anchorPoint(source, startAnchor);
  const end = target && endAnchor ? anchorPoint(target, endAnchor) : { x: start.x + 120, y: start.y };
  return { x: start.x, y: start.y, x2: end.x, y2: end.y,
    startBinding: { objectId: source.id, anchor: startAnchor },
    endBinding: target && endAnchor ? { objectId: target.id, anchor: endAnchor } : null };
}
