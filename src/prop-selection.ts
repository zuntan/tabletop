import type { DeskObject } from './model';
import { IMAGE_TITLE_HEIGHT } from './image-geometry';

export function headSelectedProp(object: DeskObject) {
  return object.type === 'prop' && object.propSelection === 'head';
}

/** Used for mouse selection only; artwork, export and camera bounds stay unchanged. */
export function propSelectionBounds(object: DeskObject) {
  return { x: object.x, y: object.y, width: object.width,
    height: headSelectedProp(object) ? Math.min(IMAGE_TITLE_HEIGHT, object.height) : object.height };
}
