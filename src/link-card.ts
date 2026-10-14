import type { DeskObject } from './model';
import { element } from './diagram-drawing';

export function drawOpenLink(group: SVGGElement, object: DeskObject) {
  if (!object.url || !['link', 'web', 'image', 'svg'].includes(object.type)) return;
  const width = Math.min(28, object.width), height = Math.min(24, object.height);
  const x = Math.max(0, object.width - width - 6), y = Math.max(0, Math.min(5, object.height - height));
  const label = `別タブで開く：${object.text || object.url}`;
  const link = element('a', { href: object.url, target: '_blank', rel: 'noopener noreferrer',
    tabindex: 0, 'aria-label': label, 'data-open-url': object.id, class: 'open-link' });
  const title = element('title'); title.textContent = label; link.append(title);
  link.append(element('rect', { x, y, width, height, rx: 4, fill: '#ffffff', stroke: '#cbd5e1', 'stroke-width': 1 }));
  const icon = element('text', { x: x + width / 2, y: y + height / 2, 'font-size': Math.min(18, height),
    fill: '#1d4ed8', 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'pointer-events': 'none' });
  icon.textContent = '↗'; link.append(icon);
  group.append(link);
}
