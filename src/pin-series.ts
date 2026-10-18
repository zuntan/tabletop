import type { DeskObject } from './model';
import type { Series } from './settings';

export type PinVisibility = 'all' | 'pins' | 'hidden';
export const pinVisibilityNames: Record<PinVisibility, string> = { all: 'ピンとテキスト', pins: 'ピンのみ', hidden: 'ピン非表示' };
const priority: Record<PinVisibility, number> = { all: 0, pins: 1, hidden: 2 };
export function effectivePinVisibility(global: PinVisibility, series: PinVisibility): PinVisibility {
  return priority[global] >= priority[series] ? global : series;
}

/** Anchor the fixed-size glyph and its text at the persisted bottom-center point. */
export function pinTransform(object: DeskObject, zoom: number) {
  return `translate(${object.x + object.width / 2} ${object.y + object.height}) scale(${1 / zoom}) translate(${-object.width / 2} ${-object.height})`;
}
export function pinScreenObject(object: DeskObject, zoom: number): DeskObject {
  if (object.type !== 'label') return object;
  return { ...object, x: object.x + object.width / 2 - object.width / (2 * zoom),
    y: object.y + object.height - object.height / zoom, width: object.width / zoom, height: object.height / zoom,
    fontSize: object.fontSize / zoom, strokeWidth: object.strokeWidth / zoom, cornerRadius: object.cornerRadius / zoom };
}

/** A series occupies one contiguous z-order block, anchored by its backmost member. */
export function groupPinLayers(objects: DeskObject[]): DeskObject[] {
  const groups = new Map<string, DeskObject[]>();
  for (const object of objects) if (object.type === 'label') {
    const key = object.seriesId!;
    const group = groups.get(key) ?? []; group.push(object); groups.set(key, group);
  }
  const seen = new Set<string>();
  return objects.flatMap(object => {
    if (object.type !== 'label') return [object];
    if (seen.has(object.seriesId!)) return [];
    seen.add(object.seriesId!); return groups.get(object.seriesId!)!;
  });
}
export function pinThreadMembers(objects: DeskObject[], series: Series): DeskObject[] {
  // Equal capped numbers retain their document order.
  return objects.filter(object => object.type === 'label' && object.seriesId === series.id)
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
}
