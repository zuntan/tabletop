import type { DeskObject, Operation } from './model';
import { isShape } from './geometry';

export const supportsFill = (object: DeskObject) => isShape(object) || ['text','file'].includes(object.type) || object.type === 'label';
export const transparencyPercent = (opacity: number) => Math.round((1 - opacity) * 100);
export const opacityFromPercent = (value: string) => (100 - Number(value)) / 100;

export function opacityOperations(objects: DeskObject[], fillOpacity: number): Operation[] {
  const series = new Set<string>();
  return objects.flatMap<Operation>(object => {
    if (!supportsFill(object)) return [];
    if (object.type === 'label' && object.seriesId) {
      if (series.has(object.seriesId)) return [];
      series.add(object.seriesId);
      return [{ kind: 'series_update', id: object.seriesId, patch: { fillOpacity } }];
    }
    return [{ kind: 'update', id: object.id, patch: { fillOpacity } }];
  });
}
