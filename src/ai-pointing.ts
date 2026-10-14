import type { DeskObject } from './model';
import { bounds, isConnector } from './geometry';
import { labelVisualBounds } from './label-description';

/** Presentation only: never creates editing handles or intercepts input. */
export function drawAiPointing(layer: SVGGElement, objects: DeskObject[], zoom: number, descriptionsVisible: boolean) {
  for (const object of objects) {
    const visual = isConnector(object) ? bounds(object) : labelVisualBounds(object, descriptionsVisible);
    // Keep the green frame outside the human blue frame, even on shared targets.
    const gap = 7 / zoom;
    const frame = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    const attributes = { x: visual.x - gap, y: visual.y - gap,
      width: visual.width + gap * 2, height: visual.height + gap * 2,
      fill: 'none', stroke: '#15803d', 'stroke-width': 2 / zoom,
      'stroke-dasharray': `${1 / zoom} ${4 / zoom}`, 'stroke-linecap': 'round',
      'pointer-events': 'none', 'data-ai-point': object.id, 'aria-hidden': 'true' };
    for (const [name, value] of Object.entries(attributes)) frame.setAttribute(name, String(value));
    layer.append(frame);
  }
}
