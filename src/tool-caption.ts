import { uiText, type UiKey } from './i18n/dom';
import { createIcon, type IconName } from './icons';

const buttonIcons: Record<string, IconName> = {
  'camera-capture':'camera', 'selection-mode': 'pointer', 'clear-ai-pointing': 'pointer-x',
  rect: 'rectangle', roundedRect: 'square-rounded', ellipse: 'circle', line: 'line', arrow: 'arrow-up-right',
  text: 'typography', image: 'photo', mermaid: 'rectangle', qrcode:'qr-code', web: 'world', link: 'link', numbering: 'map-pin',
  'numbering-settings': 'map-pin', clipboard: 'clipboard', 'zoom-out': 'minus', 'zoom-in': 'plus',
  'wayfinder-create':'arrow-up-right', fit: 'maximize', 'view-center': 'crosshair', 'grid-snap': 'grid-dots', 'label-descriptions': 'list-numbers',
  'doodle-create':'pencil', 'ruler-create':'ruler-2', 'file-create':'file-lock', 'clip-create': 'paperclip', 'delete-animated': 'x', 'cutout-create': 'scissors',
  front: 'arrow-bar-to-up', back: 'arrow-bar-to-down', 'mouse-lock': 'lock',
};

export const toolKeys = {
  'selection-mode': 'select',
  'clear-ai-pointing': 'clearPointing',
  'rect': 'rect',
  'roundedRect': 'roundedRect',
  'ellipse': 'ellipse',
  'line': 'line',
  'arrow': 'arrow',
  'text': 'card',
  'image': 'image',
  'mermaid': 'mermaid',
  'qrcode': 'qr',
  'web': 'web',
  'link': 'link',
  'numbering': 'pin',
  'clipboard': 'paste',
  'wayfinder-create': 'wayfinder',
  'clip-create': 'clip',
  'file-create': 'folder',
  'ruler-create': 'ruler',
  'doodle-create': 'doodle',
  'cutout-create': 'cutout',
  'zoom-out': 'zoomOut',
  'zoom-reset': 'zoomReset',
  'zoom-in': 'zoomIn',
  'fit': 'fit',
  'view-center': 'center',
  'grid-snap': 'snap',
  'label-descriptions': 'pinText',
  'numbering-settings': 'pinSettings',
  'front': 'front',
  'back': 'back',
  'delete-animated': 'delete',
  'mouse-lock': 'lock',
  'camera-capture': 'camera'
} as const;

/** Keep short visible captions separate from the full accessible name and tooltip. */
export function toolButtonContent(button: HTMLButtonElement, icon: string, label: string) {
  const symbol = document.createElement('span'); symbol.className = 'tool-icon';
  const name = buttonIcons[button.dataset.add ?? button.id];
  if (name) symbol.append(createIcon(name));
  else symbol.textContent = icon;
  symbol.setAttribute('aria-hidden', 'true');
  const caption = document.createElement('small'); caption.className = 'tool-caption';
  const key = toolKeys[(button.dataset.add ?? button.id) as keyof typeof toolKeys];
  if (key) uiText(caption, `toolbar:${key}.caption` as UiKey); else caption.textContent = label;
  button.classList.toggle('compact-caption', [...caption.textContent.replace(/\s/g,'')].length >= 2);
  button.classList.add('tool-button'); button.replaceChildren(symbol, caption);
}
