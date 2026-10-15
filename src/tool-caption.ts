const shortCaptions: Record<string, string> = {
  'selection-mode': '選択', rect: '矩形', roundedRect: '角丸', ellipse: '楕円', line: '線', arrow: '矢印', text: 'テキスト',
  image: '画像', web: 'Web資料', link: 'リンク', numbering: 'ピン', clipboard: '貼り付け',
  'zoom-out': '縮小', 'zoom-reset': '100%へ', 'zoom-in': '拡大', fit: '全体',
  'grid-snap': 'スナップ', 'label-descriptions': '説明', 'numbering-settings': 'ピン設定',
};

/** Keep short visible captions separate from the full accessible name and tooltip. */
export function toolButtonContent(button: HTMLButtonElement, icon: string, label: string) {
  const symbol = document.createElement('span'); symbol.className = 'tool-icon'; symbol.textContent = icon;
  symbol.setAttribute('aria-hidden', 'true');
  const caption = document.createElement('small'); caption.className = 'tool-caption';
  caption.textContent = shortCaptions[button.dataset.add ?? button.id] ?? label;
  button.classList.add('tool-button'); button.replaceChildren(symbol, caption);
}
