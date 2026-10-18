import type { DeskObject } from './model';
import { numberCenterY } from './pin-shape';

const namespace = 'http://www.w3.org/2000/svg';
const measuring = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
export function descriptionLayout(object: DeskObject) {
  const lines = (object.description ?? '').split('\n');
  if (measuring) measuring.font = `${object.fontSize}px sans-serif`;
  const width = Math.max(0, ...lines.map(line => measuring?.measureText(line).width ?? [...line].length * object.fontSize));
  const height = lines.length * object.fontSize * 1.25;
  return { lines, width, height, x: object.width + 12, y: numberCenterY(object.labelShape, object.height) - height / 2 };
}
export function labelVisualBounds(object: DeskObject, visible: boolean, zoom = 1) {
  const box = localVisualBounds(object, visible);
  if (object.type !== 'label') return box;
  const tip = { x: object.x + object.width / 2, y: object.y + object.height };
  return { x: tip.x + (box.x - tip.x) / zoom, y: tip.y + (box.y - tip.y) / zoom,
    width: box.width / zoom, height: box.height / zoom };
}
function localVisualBounds(object: DeskObject, visible: boolean) {
  if (object.type !== 'label' || !visible || !object.description) return { x: object.x, y: object.y, width: object.width, height: object.height };
  const layout = descriptionLayout(object);
  const top = Math.min(0, layout.y), bottom = Math.max(object.height, layout.y + layout.height);
  return { x: object.x, y: object.y + top, width: layout.x + layout.width, height: bottom - top };
}
export function drawLabelDescription(group: SVGGElement, object: DeskObject, visible: boolean) {
  if (object.type !== 'label' || !visible || !object.description) return;
  const layout = descriptionLayout(object);
  const hit = document.createElementNS(namespace, 'rect');
  for (const [key, value] of Object.entries({ x: layout.x, y: layout.y, width: Math.max(1, layout.width), height: layout.height, fill: 'transparent' })) hit.setAttribute(key, String(value));
  group.append(hit);
  const text = document.createElementNS(namespace, 'text');
  text.setAttribute('fill', object.textColor);
  text.setAttribute('font-size', String(object.fontSize));
  text.setAttribute('font-family', 'sans-serif');
  text.setAttribute('pointer-events', 'none');
  text.setAttribute('data-label-description', '');
  layout.lines.forEach((line, index) => {
    const span = document.createElementNS(namespace, 'tspan');
    span.setAttribute('x', String(layout.x));
    span.setAttribute('y', String(layout.y + object.fontSize * (index * 1.25 + 1)));
    span.textContent = line; text.append(span);
  });
  group.append(text);
}
