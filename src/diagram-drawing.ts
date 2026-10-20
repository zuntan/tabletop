import type { LineRounding } from './junction-rounding';
import { fittedShapeFont } from './shape-definitions';
import { snapConnectorEndpoint } from './connector-junctions';
import type { DeskObject } from './model';
import { anchorsFor, anchorPoint, endpoints, isConnector, isShape, isConnectable, snap, type Point } from './geometry';
import { numberCenterY } from './pin-shape';
import { drawConnectorMarker } from './connector-markers';

export function element<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}
export function drawConnector(group: SVGGElement, object: DeskObject, zoom: number, rounding?: LineRounding) {
  const { start, end } = endpoints(object);
  const dx = end.x - start.x, dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  const attrs = { x1: 0, y1: 0, x2: dx, y2: dy };
  // Only a narrow strip around the visible line is interactive, even when invisible.
  group.append(element('line', { ...attrs, stroke: 'transparent', 'stroke-width': 14,
    'vector-effect': 'non-scaling-stroke', 'pointer-events': 'stroke', class: 'connector-hit' }));
  const size = Math.min(Math.max(15, object.strokeWidth * 3.75), length / 3);
  const inset = (shape: DeskObject['startMarker']) => !shape || shape === 'none' ? 0 : size * (shape === 'circle' ? .4 : .5);
  const ux = length ? dx / length : 0, uy = length ? dy / length : 0;
  // Tuck the visible shaft inside each filled marker; logical endpoints and hit targets stay fixed.
  const from = rounding?.start || inset(object.startMarker), to = rounding?.end || inset(object.endMarker);
  const line = element('line', { x1: ux * from, y1: uy * from, x2: dx - ux * to, y2: dy - uy * to,
    stroke: object.stroke, 'stroke-width': object.strokeWidth,
    'stroke-linecap': 'round', 'pointer-events': 'none', class: 'connector-line' });
  if (object.dash && object.dash !== 'solid') line.setAttribute('stroke-dasharray', object.dash === 'dashed'
    ? `${object.strokeWidth * 4} ${object.strokeWidth * 3}` : `${object.strokeWidth} ${object.strokeWidth * 2}`);
  group.append(line);
  for (const curve of rounding?.curves ?? []) {
    const local = (p: Point) => `${p.x - object.x} ${p.y - object.y}`;
    const d = `M ${local(curve.from)} Q ${local(curve.control)} ${local(curve.to)}`;
    group.append(element('path', { d, fill: 'none', stroke: 'transparent', 'stroke-width': 14,
      'vector-effect': 'non-scaling-stroke', 'pointer-events': 'stroke', class: 'junction-hit' }));
    const path = element('path', { d, fill: 'none', stroke: object.stroke, 'stroke-width': object.strokeWidth,
      'stroke-linecap': 'round', 'pointer-events': 'none', class: 'junction-curve', 'data-junction-rounding': curve.id });
    if (line.hasAttribute('stroke-dasharray')) path.setAttribute('stroke-dasharray', line.getAttribute('stroke-dasharray')!);
    group.append(path);
  }
  if (Math.hypot(dx, dy) < 1) group.append(element('circle', { cx: 0, cy: 0, r: 7 / zoom, fill: 'transparent' }));
  if (length >= 1) {
    const angle = Math.atan2(dy, dx);
    drawConnectorMarker(group, object.startMarker ?? 'none', 0, 0, angle + Math.PI, size, object.stroke, 'start');
    drawConnectorMarker(group, object.endMarker ?? 'none', dx, dy, angle, size, object.stroke, 'end');
  }
}
const shapeMeasure = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
export function drawShapeText(group: SVGGElement, object: DeskObject) {
  if (!isShape(object) || !object.text) return;
  const lines = object.text.split('\n');
  const measure = shapeMeasure;
  if (measure) measure.font = '100px sans-serif';
  const size = object.type === 'label' ? object.fontSize : fittedShapeFont(object.type, object.width, object.height,
    object.text, object.fontSize, object.textFit, line => measure ? measure.measureText(line).width / 100 : line.length * .6);
  const text = element('text', { fill: object.textColor, 'font-size': size,
    'font-family': 'sans-serif', 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'pointer-events': 'none', class: 'shape-text' });
  lines.forEach((line, i) => {
    const span = element('tspan', { x: object.width / 2,
      y: numberCenterY(object.type === 'label' ? object.labelShape : undefined, object.height) + (i - (lines.length - 1) / 2) * size * 1.25 });
    span.textContent = line; text.append(span);
  });
  group.append(text);
}
export function drawEndpointHandles(layer: SVGGElement, object: DeskObject, zoom: number, interactive: boolean, color = '#2563eb') {
  if (!isConnector(object)) return false;
  const points = endpoints(object);
  for (const side of ['start', 'end'] as const) {
    const point = points[side], connected = !!(object[side === 'start' ? 'startBinding' : 'endBinding'] || object[side === 'start' ? 'startJunction' : 'endJunction']);
    layer.append(element('circle', { cx: point.x, cy: point.y, r: 6 / zoom,
      fill: connected ? '#16a34a' : color, stroke: '#fff', 'stroke-width': 1.5 / zoom,
      ...(interactive ? { 'data-endpoint': side, 'data-connector': object.id, class: 'endpoint-handle' } : { 'pointer-events': 'none' }) }));
  }
  return true;
}
export function drawSnapTargets(layer: SVGGElement, objects: DeskObject[], point: Point, zoom: number) {
  const candidate = snap(point, objects, 18 / zoom);
  const line = snapConnectorEndpoint(point, objects, 18 / zoom, '');
  for (const object of objects.filter(isConnector)) {
    const points = endpoints(object);
    for (const side of ['start', 'end'] as const) {
      const p = points[side], active = line?.object.id === object.id && line.side === side;
      layer.append(element('circle', { cx: p.x, cy: p.y, r: (active ? 8 : 4) / zoom,
        fill: active ? '#16a34a' : '#fff', stroke: active ? '#15803d' : '#94a3b8',
        'stroke-width': 1.5 / zoom, 'pointer-events': 'none', class: active ? 'snap-target active' : 'snap-target' }));
    }
  }
  for (const object of objects) {
    if (!isConnectable(object,objects)) continue;
    for (const anchor of anchorsFor(object,objects)) {
      const p = anchorPoint(object, anchor);
      const active = candidate?.binding.objectId === object.id && candidate.binding.anchor === anchor;
      layer.append(element('circle', { cx: p.x, cy: p.y, r: (active ? 8 : 4) / zoom,
        fill: active ? '#16a34a' : '#ffffff', stroke: active ? '#15803d' : '#94a3b8',
        'stroke-width': 1.5 / zoom, 'pointer-events': 'none', class: active ? 'snap-target active' : 'snap-target' }));
    }
  }
}
export function updateScenePreview(layer: SVGGElement, scene: DeskObject[], original: DeskObject[], draw: (object: DeskObject) => void, forceLines = false) {
  const previous = new Map(original.map(o => [o.id, o]));
  const present = new Set(scene.map(o=>o.id));
  for(const node of [...layer.children]) if(node.hasAttribute('data-id') && !present.has(node.getAttribute('data-id')!)) node.remove();
  for (const object of scene) {
    const old = previous.get(object.id)!;
    if (!(forceLines && isConnector(object)) && JSON.stringify(object) === JSON.stringify(old)) continue;
    const node = [...layer.children].find(el => el.getAttribute('data-id') === object.id);
    if (!node) continue;
    if (['web', 'image', 'svg', 'mermaid', 'prop'].includes(object.type)) {
      // Avoid reloading external media while moving. Resize is committed on release.
      node.setAttribute('transform', `translate(${object.x} ${object.y})`);
    } else {
      draw(object);
      node.replaceWith(layer.lastElementChild!);
    }
  }
  if (scene.map(o=>o.id).join('|') !== original.map(o=>o.id).join('|')) for(const object of scene) {
    const node=[...layer.children].find(node=>node.getAttribute('data-id')===object.id); if(node) layer.append(node);
  }
}
