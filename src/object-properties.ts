import type { DeskObject } from './model';
import { isShapeType } from './shape-definitions';
import { stickerTarget } from './sticker-values';

export type PublishedObject = Pick<DeskObject, 'id' | 'type' | 'x' | 'y'> & Partial<Omit<DeskObject, 'id' | 'type' | 'x' | 'y'>>;
const common = ['id', 'type', 'x', 'y', 'locked', 'reactions'] as const;
const box = ['width', 'height'] as const;
const paint = ['fill', 'fillOpacity', 'stroke', 'strokeWidth'] as const;
const text = ['text', 'textColor', 'fontSize'] as const;
export function objectPropertyNames(object: DeskObject): readonly (keyof DeskObject)[] {
  const decoration = stickerTarget(object) ? ['stickers' as const] : [];
  if (object.type === 'line') return [...common, 'x2', 'y2', 'stroke', 'strokeWidth', 'dash',
    'startMarker', 'endMarker', 'startBinding', 'endBinding', 'startJunction', 'endJunction', 'junctionRounding'];
  if (object.type === 'file') return [...common,...box,...paint,...text,'fileMembers','stamp'];
  if (object.type === 'clip') return [...common,...box,'fill','clipMembers','clipAnchor','clipOffset','clipOffsetMode','clipOffsetPercent','clipSize','clipAutoSize','clipStyle'];
  if (object.type === 'prop') return [...common, ...box, 'text', 'src'];
  if (object.type === 'mermaid') return [...common, ...decoration, ...box, 'text', 'mermaidSource', 'cutout'];
  if (object.type === 'text') return [...common, ...decoration, ...box, ...paint, ...text, 'cornerRadius', 'padding', 'callout', 'stamp', 'cutout'];
  if (isShapeType(object.type)) return [...common, ...decoration, ...box, ...paint, ...text, 'textFit',
    ...(object.type === 'roundedRect' ? ['cornerRadius' as const] : [])];
  if (object.type === 'label') return [...common, ...box, ...text, 'seriesId', 'number', 'labelShape', 'description', 'attachment',
    ...(object.labelShape === 'text' ? [] : paint),
    ...(object.labelShape === 'roundedRect' ? ['cornerRadius' as const] : [])];
  // Media/link cards currently use fixed decoration; only their content and geometry are configurable.
  return [...common, ...decoration, ...box, 'text', ...(object.deskPath?['deskPath' as const]:['url' as const]), ...(['image','svg','web'].includes(object.type)?['cutout' as const]:[]), ...(['image', 'svg'].includes(object.type) ? ['src' as const] : [])];
}
/** Publish meaningful fields, including explicit zero/default values. Never mutate runtime state. */
export function publishObject(object: DeskObject): PublishedObject {
  return Object.fromEntries(objectPropertyNames(object).filter(key => object[key] !== undefined)
    .map(key => [key, structuredClone(object[key])])) as PublishedObject;
}
