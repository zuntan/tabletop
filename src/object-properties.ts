import type { DeskObject } from './model';
import { isShapeType } from './shape-definitions';

export type PublishedObject = Pick<DeskObject, 'id' | 'type' | 'x' | 'y'> & Partial<Omit<DeskObject, 'id' | 'type' | 'x' | 'y'>>;
const common = ['id', 'type', 'x', 'y', 'locked', 'reactions'] as const;
const box = ['width', 'height'] as const;
const paint = ['fill', 'fillOpacity', 'stroke', 'strokeWidth'] as const;
const text = ['text', 'textColor', 'fontSize'] as const;
export function objectPropertyNames(object: DeskObject): readonly (keyof DeskObject)[] {
  if (object.type === 'line') return [...common, 'x2', 'y2', 'stroke', 'strokeWidth', 'dash',
    'startMarker', 'endMarker', 'startBinding', 'endBinding', 'startJunction', 'endJunction', 'junctionRounding'];
  if (object.type === 'clip') return [...common,...box,'fill','clipMembers','clipAnchor','clipOffset','clipSize','clipStyle'];
  if (object.type === 'prop') return [...common, ...box, 'text', 'src'];
  if (object.type === 'mermaid') return [...common, ...box, 'text', 'mermaidSource'];
  if (object.type === 'text') return [...common, ...box, ...paint, ...text, 'cornerRadius', 'padding', 'callout', 'stamp'];
  if (isShapeType(object.type)) return [...common, ...box, ...paint, ...text, 'textFit',
    ...(object.type === 'roundedRect' ? ['cornerRadius' as const] : [])];
  if (object.type === 'label') return [...common, ...box, ...text, 'seriesId', 'number', 'labelShape', 'description', 'attachment',
    ...(object.labelShape === 'text' ? [] : paint),
    ...(object.labelShape === 'roundedRect' ? ['cornerRadius' as const] : [])];
  // Media/link cards currently use fixed decoration; only their content and geometry are configurable.
  return [...common, ...box, 'text', 'url', ...(['image', 'svg'].includes(object.type) ? ['src' as const] : [])];
}
/** Publish meaningful fields, including explicit zero/default values. Never mutate runtime state. */
export function publishObject(object: DeskObject): PublishedObject {
  return Object.fromEntries(objectPropertyNames(object).filter(key => object[key] !== undefined)
    .map(key => [key, structuredClone(object[key])])) as PublishedObject;
}
