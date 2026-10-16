import type { DeskObject } from './model';
import { bounds, isConnector } from './geometry';
import { labelVisualBounds } from './label-description';
import { element } from './diagram-drawing';
import { lockBodyPath } from './lock-controls';

/** Screen-sized, non-interactive lock glyph replaces the bottom-right resize handle. */
export function drawLockedSelection(layer: SVGGElement, object: DeskObject, zoom: number, descriptionsVisible: boolean) {
  const box = isConnector(object) ? bounds(object) : labelVisualBounds(object, descriptionsVisible);
  layer.append(element('rect', { x: box.x - 3 / zoom, y: box.y - 3 / zoom,
    width: box.width + 6 / zoom, height: box.height + 6 / zoom, fill: 'none', stroke: '#2563eb',
    'stroke-width': 1.5 / zoom, 'stroke-dasharray': `${2 / zoom} ${2 / zoom}`,
    'pointer-events': 'none', 'data-locked-selection': object.id }));
  const badge = element('g', { transform: `translate(${box.x + box.width} ${box.y + box.height}) scale(${1 / zoom})`,
    'pointer-events': 'none', 'data-lock-badge': object.id, 'aria-hidden': 'true' });
  badge.append(element('rect', { x: -11, y: -11, width: 22, height: 22, rx: 4, fill: '#fff', stroke: '#2563eb' }));
  badge.append(element('path', { d: lockBodyPath, transform: 'translate(-9 -9) scale(.75)', fill: 'none', stroke: '#2563eb', 'stroke-width': 2 }));
  layer.append(badge);
}
