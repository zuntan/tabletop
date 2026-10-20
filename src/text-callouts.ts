import type { DeskObject } from './model';
import { anchorPoint, isConnectable, type Point } from './geometry';

export function resolveTextCallouts(objects: DeskObject[], before: DeskObject[]): DeskObject[] {
  const map = new Map(objects.map(o => [o.id, o])), old = new Map(before.map(o => [o.id, o]));
  return objects.map(object => {
    if (!object.callout) return object;
    if (object.type !== 'text') throw new Error('Callouts are supported only on text');
    const binding = object.callout.binding;
    if (!binding) return object;
    const target = map.get(binding.objectId);
    if (!target || !isConnectable(target,objects)) {
      if (old.get(object.id)?.callout?.binding?.objectId === binding.objectId && old.has(binding.objectId))
        return { ...object, callout: { ...object.callout, binding: null } };
      throw new Error('Unknown callout target');
    }
    if (target.id === object.id) throw new Error('A callout cannot attach to itself');
    return { ...object, callout: { ...object.callout, ...anchorPoint(target, binding.anchor) } };
  });
}
/** One filled outline: no doubled stroke or transparency seam where the tail meets the body. */
function tailGeometry(object: DeskObject) {
  const w = object.width, h = object.height, r = Math.min(object.cornerRadius, w / 4, h / 4);
  const tip = object.callout ? { x: object.callout.x - object.x, y: object.callout.y - object.y } : null;
  let side = '', center = 0, half = 0;
  if (tip && (tip.x < 0 || tip.x > w || tip.y < 0 || tip.y > h)) {
    const dx = tip.x - w / 2, dy = tip.y - h / 2;
    side = Math.abs(dx / w) > Math.abs(dy / h) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'bottom' : 'top';
    const horizontal = side === 'top' || side === 'bottom', length = horizontal ? w : h;
    half = Math.min(object.callout?.style === 'leader' ? 0 : object.callout?.style === 'thought' ? 54 : 36, (length - 2 * r) / 2);
    const crossing = horizontal ? w / 2 + dx * (h / 2) / Math.abs(dy) : h / 2 + dy * (w / 2) / Math.abs(dx);
    center = Math.max(r + half, Math.min(length - r - half, crossing));
  }
  const root = side === 'top' ? { x: center, y: 0 } : side === 'bottom' ? { x: center, y: h }
    : side === 'right' ? { x: w, y: center } : { x: 0, y: center };
  return { w, h, r, tip, side, center, half, root };
}

/** Fit up to three separate circles, reserving space before the logical tip. */
export function thoughtBubbles(object: DeskObject): { x: number; y: number; radius: number }[] {
  const { tip, side, root } = tailGeometry(object);
  if (!tip || !side) return [];
  const dx = tip.x - root.x, dy = tip.y - root.y, length = Math.hypot(dx, dy);
  const minimum = Math.max(5, object.strokeWidth / 2 + 2);
  const gap = Math.max(4, object.strokeWidth + 2), margin = Math.max(4, object.strokeWidth / 2 + 2);
  for (let count = 3; count >= 1; count--) {
    const preferred = count === 3 ? [24, 15, 8] : count === 2 ? [15, 8] : [8];
    const radiiAt = (scale: number) => preferred.map((r, i) => Math.max(minimum + (count - 1 - i) * 2, r * scale));
    const fractions = count === 3 ? [1/6, 1/2, 5/6] : count === 2 ? [1/4, 3/4] : [1/2];
    const fits = (radii: number[]) => radii.every((radius, i) =>
      fractions[i] * length - radius >= margin && fractions[i] * length + radius <= length - margin
      && (i === 0 || (fractions[i] - fractions[i-1]) * length >= radii[i-1] + radius + gap));
    if (!fits(radiiAt(0))) continue;
    let low = 0, high = 1;
    for (let i = 0; i < 25; i++) {
      const mid = (low + high) / 2;
      if (fits(radiiAt(mid))) low = mid; else high = mid;
    }
    return radiiAt(low).map((radius, i) => ({
      x: root.x + dx * fractions[i], y: root.y + dy * fractions[i], radius,
    }));
  }
  return [];
}
/** Speech is one continuous outline; thought uses separate circular subpaths. */
export function calloutPath(object: DeskObject): string {
  const { w, h, r, tip, side, center, half } = tailGeometry(object);
  const thought = object.callout?.style === 'thought';
  function tail(edge: string, reverse: boolean) {
    if (thought || object.callout?.style === 'leader' || !tip || side !== edge) return '';
    const a = center + (reverse ? half : -half), b = center + (reverse ? -half : half);
    const p = (value: number) => edge === 'top' ? value + ',0' : edge === 'bottom' ? value + ',' + h : edge === 'right' ? w + ',' + value : '0,' + value;
    return ' L' + p(a) + ' L' + tip.x + ',' + tip.y + ' L' + p(b);
  }
  const body = 'M' + r + ',0' + tail('top', false) + ' H' + (w-r) + ' Q' + w + ',0 ' + w + ',' + r
    + tail('right', false) + ' V' + (h-r) + ' Q' + w + ',' + h + ' ' + (w-r) + ',' + h
    + tail('bottom', true) + ' H' + r + ' Q0,' + h + ' 0,' + (h-r)
    + tail('left', true) + ' V' + r + ' Q0,0 ' + r + ',0 Z';
  return body + (thought ? thoughtBubbles(object).map(({ x, y, radius: r }) =>
    ' M' + (x+r) + ',' + y + ' a' + r + ',' + r + ' 0 1,0 ' + (-2*r) + ',0 a' + r + ',' + r + ' 0 1,0 ' + (2*r) + ',0 Z').join('') : '');
}

/** A short outward stub followed by a diagonal, kept outside the body. */
export function leaderGeometry(object: DeskObject) {
  const { root, tip, side } = tailGeometry(object);
  if (!tip || !side) return null;
  const normal = side === 'left' ? { x: -1, y: 0 } : side === 'right' ? { x: 1, y: 0 }
    : side === 'top' ? { x: 0, y: -1 } : { x: 0, y: 1 };
  const normalDistance = (tip.x-root.x)*normal.x + (tip.y-root.y)*normal.y;
  const length = Math.hypot(tip.x-root.x, tip.y-root.y);
  const stub = Math.min(32, length * .3, normalDistance / 2);
  return { root, knee: { x: root.x + normal.x*stub, y: root.y + normal.y*stub }, tip };
}
export function drawCalloutLeader(group: SVGGElement, object: DeskObject) {
  group.querySelectorAll('.callout-leader, .callout-leader-dot').forEach(node => node.remove());
  if (object.callout?.style !== 'leader') return;
  const geometry = leaderGeometry(object);
  if (!geometry) return;
  const { root, knee, tip } = geometry, ns = 'http://www.w3.org/2000/svg';
  const path = document.createElementNS(ns, 'path');
  for (const [key, value] of Object.entries({
    d: 'M' + root.x + ',' + root.y + ' L' + knee.x + ',' + knee.y + ' L' + tip.x + ',' + tip.y,
    fill: 'none', stroke: object.stroke, 'stroke-width': object.strokeWidth,
    'stroke-linejoin': 'round', 'stroke-linecap': 'round', class: 'callout-leader',
  })) path.setAttribute(key, String(value));
  const dot = document.createElementNS(ns, 'circle');
  for (const [key, value] of Object.entries({ cx: tip.x, cy: tip.y, r: Math.max(3, object.strokeWidth * .75),
    fill: object.stroke, class: 'callout-leader-dot' })) dot.setAttribute(key, String(value));
  group.append(path, dot);
}
