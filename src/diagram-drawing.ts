import type { DeskObject } from './model';
import { anchors, anchorPoint, endpoints, isConnector, isShape, snap, type Point } from './geometry';

export function element<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}
export function drawConnector(group: SVGGElement, object: DeskObject, zoom: number) {
  const { start, end } = endpoints(object);
  const dx = end.x - start.x, dy = end.y - start.y;
  const attrs = { x1: 0, y1: 0, x2: dx, y2: dy };
  // Only a narrow strip around the visible line is interactive, even when invisible.
  group.append(element('line', { ...attrs, stroke: 'transparent', 'stroke-width': 14,
    'vector-effect': 'non-scaling-stroke', 'pointer-events': 'stroke', class: 'connector-hit' }));
  group.append(element('line', { ...attrs, stroke: object.stroke, 'stroke-width': object.strokeWidth,
    'stroke-linecap': 'round', 'pointer-events': 'none', class: 'connector-line' }));
  if (Math.hypot(dx, dy) < 1) group.append(element('circle', { cx: 0, cy: 0, r: 7 / zoom, fill: 'transparent' }));
  if (object.type === 'arrow') {
    const size = Math.min(Math.max(12, object.strokeWidth * 3), Math.hypot(dx, dy) / 3);
    const angle = Math.atan2(dy, dx), a = angle + 2.6, b = angle - 2.6;
    group.append(element('polygon', { points: `${dx},${dy} ${dx + size * Math.cos(a)},${dy + size * Math.sin(a)} ${dx + size * Math.cos(b)},${dy + size * Math.sin(b)}`,
      fill: object.stroke, 'pointer-events': 'none', class: 'arrow-head' }));
  }
}
export function drawShapeText(group: SVGGElement, object: DeskObject) {
  if (!isShape(object) || !object.text) return;
  const lines = object.text.split('\n');
  const text = element('text', { fill: object.textColor, 'font-size': object.fontSize,
    'font-family': 'sans-serif', 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'pointer-events': 'none', class: 'shape-text' });
  lines.forEach((line, i) => {
    const span = element('tspan', { x: object.width / 2,
      y: object.height / 2 + (i - (lines.length - 1) / 2) * object.fontSize * 1.25 });
    span.textContent = line; text.append(span);
  });
  group.append(text);
}
export function drawEndpointHandles(layer: SVGGElement, object: DeskObject, zoom: number, interactive: boolean) {
  if (!isConnector(object)) return false;
  const points = endpoints(object);
  for (const side of ['start', 'end'] as const) {
    const point = points[side], connected = !!object[side === 'start' ? 'startBinding' : 'endBinding'];
    layer.append(element('circle', { cx: point.x, cy: point.y, r: 6 / zoom,
      fill: connected ? '#16a34a' : '#2563eb', stroke: '#fff', 'stroke-width': 1.5 / zoom,
      ...(interactive ? { 'data-endpoint': side, 'data-connector': object.id, class: 'endpoint-handle' } : { 'pointer-events': 'none' }) }));
  }
  return true;
}
export function drawSnapTargets(layer: SVGGElement, objects: DeskObject[], point: Point, zoom: number) {
  const candidate = snap(point, objects, 18 / zoom);
  for (const object of objects) {
    if (!isShape(object)) continue;
    for (const anchor of anchors) {
      const p = anchorPoint(object, anchor);
      const active = candidate?.binding.objectId === object.id && candidate.binding.anchor === anchor;
      layer.append(element('circle', { cx: p.x, cy: p.y, r: (active ? 8 : 4) / zoom,
        fill: active ? '#16a34a' : '#ffffff', stroke: active ? '#15803d' : '#94a3b8',
        'stroke-width': 1.5 / zoom, 'pointer-events': 'none', class: active ? 'snap-target active' : 'snap-target' }));
    }
  }
}
export function updateScenePreview(layer: SVGGElement, scene: DeskObject[], original: DeskObject[], draw: (object: DeskObject) => void) {
  const previous = new Map(original.map(o => [o.id, o]));
  for (const object of scene) {
    const old = previous.get(object.id)!;
    if (JSON.stringify(object) === JSON.stringify(old)) continue;
    const node = [...layer.children].find(el => el.getAttribute('data-id') === object.id);
    if (!node) continue;
    if (['web', 'image', 'svg'].includes(object.type)) {
      // Avoid reloading external media while moving. Resize is committed on release.
      node.setAttribute('transform', `translate(${object.x} ${object.y})`);
    } else {
      draw(object);
      node.replaceWith(layer.lastElementChild!);
    }
  }
}
