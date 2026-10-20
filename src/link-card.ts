import { openMedia } from './media-viewer';
import type { DeskObject } from './model';
import { element } from './diagram-drawing';

export function drawOpenLink(group: SVGGElement, object: DeskObject) {
  const media = ['image', 'svg', 'mermaid'].includes(object.type);
  if (object.url && ['link', 'web', 'image', 'svg'].includes(object.type)) drawControl(group, object, false, 0);
  if (media) drawControl(group, object, true, object.url ? 32 : 0);
}
function drawControl(group: SVGGElement, object: DeskObject, media: boolean, offset: number) {
  const width = Math.min(28, object.width), height = Math.min(24, object.height);
  const x = Math.max(0, object.width - width - 6 - offset), y = Math.max(0, Math.min(5, object.height - height));
  const label = `${media ? '画像を別タブで開く' : '別タブで開く'}：${object.text || object.url || object.type}`;
  const link = element('a', { href: media ? 'about:blank' : object.url!, target: '_blank', rel: 'noopener noreferrer',
    tabindex: 0, 'aria-label': label, [media ? 'data-open-media' : 'data-open-url']: object.id, class: 'open-link' });
  if (media) {
    link.setAttribute('data-open-media', object.id);
    link.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); openMedia(object); });
    link.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); openMedia(object); }
    });
  }
  const title = element('title'); title.textContent = label; link.append(title);
  link.append(element('rect', { x, y, width, height, rx: 4, fill: '#ffffff', stroke: '#cbd5e1', 'stroke-width': 1 }));
  const icon = element('text', { x: x + width / 2, y: y + height / 2, 'font-size': Math.min(18, height),
    fill: '#1d4ed8', 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'pointer-events': 'none' });
  icon.textContent = '↗'; link.append(icon);
  group.append(link);
}
