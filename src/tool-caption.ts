import { createIcon, type IconName } from './icons';

const buttonIcons: Record<string, IconName> = {
  'selection-mode': 'pointer', 'clear-ai-pointing': 'pointer-x',
  rect: 'rectangle', roundedRect: 'square-rounded', ellipse: 'circle', line: 'line', arrow: 'arrow-up-right',
  text: 'typography', image: 'photo', mermaid: 'rectangle', web: 'world', link: 'link', numbering: 'map-pin',
  'numbering-settings': 'map-pin', clipboard: 'clipboard', 'zoom-out': 'minus', 'zoom-in': 'plus',
  fit: 'maximize', 'view-center': 'crosshair', 'grid-snap': 'grid-dots', 'label-descriptions': 'list-numbers',
  'ruler-create':'ruler-2', 'file-create':'file-lock', 'clip-create': 'paperclip', 'delete-animated': 'x', 'cutout-create': 'scissors',
  front: 'arrow-bar-to-up', back: 'arrow-bar-to-down', 'mouse-lock': 'lock',
};

const shortCaptions: Record<string, string> = {
  'file-create':'クリア\nファイル', 'clear-ai-pointing': 'AI選択解除', 'delete-animated': '削除', 'cutout-create': '型抜き',
  'selection-mode': '選択', rect: '矩形', roundedRect: '角丸', ellipse: '楕円', line: '線', arrow: '矢印', text: 'カード',
  image: '画像', mermaid: 'Mermaid', web: 'Web資料', link: 'リンク', numbering: 'ピン', clipboard: '貼り付け',
  'zoom-out': '縮小', 'zoom-reset': '100%へ', 'zoom-in': '拡大', fit: '全体', 'view-center': '中心',
  'grid-snap': 'スナップ', 'label-descriptions': 'ピンとテキスト', 'numbering-settings': 'ピン設定',
};

/** Keep short visible captions separate from the full accessible name and tooltip. */
export function toolButtonContent(button: HTMLButtonElement, icon: string, label: string) {
  const symbol = document.createElement('span'); symbol.className = 'tool-icon';
  const name = buttonIcons[button.dataset.add ?? button.id];
  if (name) symbol.append(createIcon(name));
  else symbol.textContent = icon;
  symbol.setAttribute('aria-hidden', 'true');
  const caption = document.createElement('small'); caption.className = 'tool-caption';
  caption.textContent = shortCaptions[button.dataset.add ?? button.id] ?? label;
  button.classList.add('tool-button'); button.replaceChildren(symbol, caption);
}
