import type { DeskObject } from './model';
import { bounds } from './geometry';
import { labelVisualBounds } from './label-description';

/** Fit visual bounds without changing objects; leave room for the floating view controls. */
export function fittedCamera(objects: DeskObject[], width: number, height: number, descriptionsVisible = true) {
  if (!objects.length || width <= 0 || height <= 0) return null;
  const boxes = objects.map(object => object.type === 'label' ? labelVisualBounds(object, descriptionsVisible) : bounds(object));
  const minX = Math.min(...boxes.map(box => box.x)), minY = Math.min(...boxes.map(box => box.y));
  const maxX = Math.max(...boxes.map(box => box.x + box.width)), maxY = Math.max(...boxes.map(box => box.y + box.height));
  const availableWidth = Math.max(1, width - 100), availableHeight = Math.max(1, height - 130);
  const zoom = Math.max(0.05, Math.min(2, availableWidth / Math.max(1, maxX - minX), availableHeight / Math.max(1, maxY - minY)));
  return {
    x: width / 2 - (minX + maxX) / 2 * zoom,
    y: Math.max(0, (height - 30) / 2) - (minY + maxY) / 2 * zoom,
    zoom,
  };
}
