import type { DeskObject } from './model';

const angles: Record<string, number> = { top: 0, 'top-right': 45, right: 90, 'bottom-right': 135, bottom: 180, 'bottom-left': 225, left: 270, 'top-left': 315 };
/** Size is the unrotated long side; bounds include rotation about the SVG center. */
export function clipAppearance(object: Pick<DeskObject, 'clipSize' | 'clipStyle' | 'clipAnchor'>) {
  const size = object.clipSize ?? 64, wire = object.clipStyle === 'wire';
  const width = size * (wire ? .75 : 1), height = size * (wire ? 1 : .75);
  const angle = angles[object.clipAnchor ?? 'top-left'] ?? 0;
  const radians = angle * Math.PI / 180, cos = Math.abs(Math.cos(radians)), sin = Math.abs(Math.sin(radians));
  const inset = wire ? size * .25 : 0;
  return { width, height, angle, insetX: -Math.sin(radians) * inset, insetY: Math.cos(radians) * inset, boundsWidth: width * cos + height * sin, boundsHeight: width * sin + height * cos };
}
