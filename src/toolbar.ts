import { toolButtonContent } from './tool-caption';

export function iconButton(button: HTMLButtonElement, icon: string, label: string) {
  toolButtonContent(button, icon, label);
  button.title = label;
  button.setAttribute('aria-label', label);
}

export function groupToolbar(nav: HTMLElement) {
  const parts = document.createElement('div');
  parts.className = 'toolbar-group toolbar-parts';
  parts.setAttribute('role', 'group');
  parts.setAttribute('aria-label', '選択・部品を追加');
  const select = document.createElement('button');
  select.id = 'selection-mode';
  iconButton(select, '↖', '選択モード（Esc）');
  select.setAttribute('aria-pressed', 'true');
  parts.append(select);
  const clearAi = document.createElement('button');
  clearAi.id = 'clear-ai-pointing';
  iconButton(clearAi, '↖×', 'AIの選択（指差し）を解除');
  clearAi.disabled = true;
  parts.append(clearAi);
  const icons: Record<string, [string, string]> = {
    rect: ['▭', '矩形'], roundedRect: ['▢', '角丸矩形'], ellipse: ['◯', '楕円'],
    line: ['╱', '線'], arrow: ['↗', '矢印'], text: ['T', 'カード'],
    image: ['▧', '画像 / SVG'], mermaid: ['▧', 'Mermaid'], web: ['◎', 'Web資料'], link: ['↗▤', 'リンク'], numbering: ['📍', 'ピンを配置'],
    clipboard: ['▣', 'クリップボードから追加'],
  };
  const partOrder = ['rect', 'roundedRect', 'ellipse', 'line', 'arrow', 'numbering', 'text', 'image', 'mermaid', 'web', 'link', 'clipboard'];
  partOrder.forEach(key => {
    const button = nav.querySelector<HTMLButtonElement>(`[data-add="${key}"], #${key}`)!;
    const [icon, label] = icons[key];
    iconButton(button, icon, label);
    parts.append(button);
  });
  const defaults = nav.querySelector<HTMLElement>('#authoring-tools')!;
  defaults.classList.add('toolbar-group');
  defaults.setAttribute('role', 'group');
  defaults.setAttribute('aria-label', '作成時の初期設定');
  const view = document.createElement('div');
  view.className = 'toolbar-group toolbar-view';
  view.setAttribute('role', 'group');
  view.setAttribute('aria-label', '表示');
  for (const [id, icon, label] of [['zoom-out', '−', '縮小'], ['zoom-reset', '', 'ズームを100%に戻す'], ['zoom-in', '＋', '拡大'], ['fit', '⛶', '全体表示']]) {
    const button = nav.querySelector<HTMLButtonElement>(`#${id}`)!;
    iconButton(button, icon || button.textContent || '100%', label);
    view.append(button);
  }
  for (const [id, icon, label] of [['grid-snap', '⊞', 'グリッドにスナップ'], ['label-descriptions', '☷', 'ピンの説明文を隠す']]) {
    const button = document.createElement('button');
    button.id = id;
    iconButton(button, icon, label);
    button.setAttribute('aria-pressed', String(id === 'label-descriptions'));
    view.append(button);
  }
  nav.querySelector('.spacer')?.remove();
  nav.replaceChildren(parts, defaults, view);
}
