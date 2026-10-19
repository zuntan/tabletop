export type EndpointShape = 'none' | 'arrow' | 'circle' | 'diamond';

/** Markers extend inward from an endpoint; their outer tip stays on its binding. */
export function drawConnectorMarker(group: SVGElement, shape: EndpointShape, x: number, y: number, angle: number, size: number, color: string, side: 'start' | 'end') {
  if (shape === 'none') return;
  const point = (back: number, across = 0) => `${x - Math.cos(angle) * back - Math.sin(angle) * across},${y - Math.sin(angle) * back + Math.cos(angle) * across}`;
  const node = document.createElementNS('http://www.w3.org/2000/svg', shape === 'circle' ? 'circle' : 'polygon');
  const attrs = shape === 'circle'
    ? { cx: x - Math.cos(angle) * size * .4, cy: y - Math.sin(angle) * size * .4, r: size * .4 }
    : { points: shape === 'diamond' ? [point(0), point(size / 2, size * .4), point(size), point(size / 2, -size * .4)].join(' ')
      : [point(0), point(size * .857, size * .516), point(size * .857, -size * .516)].join(' ') };
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  node.setAttribute('fill', color); node.setAttribute('pointer-events', 'none');
  node.setAttribute('class', `connector-marker${shape === 'arrow' ? ' arrow-head' : ''}`);
  node.setAttribute('data-marker-side', side); node.setAttribute('data-marker-shape', shape);
  group.append(node);
}
