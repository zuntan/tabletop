import type { DeskObject } from './model';
import { bounds } from './geometry';
import { labelVisualBounds } from './label-description';

/** Fit visual bounds without changing objects; leave room for the floating view controls. */
export function fittedCamera(objects: DeskObject[], width: number, height: number, descriptionsVisible = true) {
  if (!objects.length || width <= 0 || height <= 0) return null;
  const availableWidth = Math.max(1, width - 100), availableHeight = Math.max(1, height - 130);
  function extent(zoom: number) {
    const boxes = objects.map(object => object.type === 'label' ? labelVisualBounds(object, descriptionsVisible, zoom) : bounds(object));
    return { minX: Math.min(...boxes.map(box => box.x)), minY: Math.min(...boxes.map(box => box.y)),
      maxX: Math.max(...boxes.map(box => box.x + box.width)), maxY: Math.max(...boxes.map(box => box.y + box.height)) };
  }
  let { minX, minY, maxX, maxY } = extent(1);
  let zoom = Math.max(0.05, Math.min(2, availableWidth / Math.max(1, maxX - minX), availableHeight / Math.max(1, maxY - minY)));
  if (objects.some(object => object.type === 'label')) {
    let low = 0.05, high = 2;
    for (let i = 0; i < 40; i++) {
      const mid = (low + high) / 2, box = extent(mid);
      if ((box.maxX - box.minX) * mid <= availableWidth && (box.maxY - box.minY) * mid <= availableHeight) low = mid;
      else high = mid;
    }
    const full = extent(2);
    zoom = (full.maxX - full.minX) * 2 <= availableWidth && (full.maxY - full.minY) * 2 <= availableHeight ? 2 : low;
    ({ minX, minY, maxX, maxY } = extent(zoom));
  }
  return {
    x: width / 2 - (minX + maxX) / 2 * zoom,
    y: Math.max(0, (height - 30) / 2) - (minY + maxY) / 2 * zoom,
    zoom,
  };
}
