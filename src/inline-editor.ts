import type { DeskObject } from './model';
type EditorPatch = { text?: string; description?: string; url?: string };

export function createInlineEditor(workspace: HTMLElement, viewport: SVGGElement,
  save: (object: DeskObject, patch: EditorPatch, fresh: boolean) => void) {
  let active: { object: DeskObject; fresh: boolean; panel: HTMLDivElement; text: HTMLTextAreaElement; url?: HTMLInputElement; error: HTMLElement } | null = null;
  let composing = false;
  function close() { active?.panel.remove(); active = null; composing = false; }
  function reposition() {
    if (!active) return;
    const matrix = viewport.getScreenCTM(); if (!matrix) return;
    const point = new DOMPoint(active.object.x, active.object.y).matrixTransform(matrix);
    const rect = workspace.getBoundingClientRect();
    Object.assign(active.panel.style, { left: `${point.x - rect.left}px`, top: `${point.y - rect.top}px`,
      width: `${Math.max(220, active.object.width * matrix.a)}px` });
  }
  function commit() {
    if (!active) return true;
    const { object, text, url, fresh, error } = active;
    try {
      const patch: EditorPatch = object.type === 'label' ? { description: text.value } : { text: text.value };
      if (url && ['image', 'svg'].includes(object.type) && !url.value.trim()) patch.url = '';
      else if (url) {
        const value = new URL(url.value);
        if (!['http:', 'https:'].includes(value.protocol)) throw new Error('HTTP(S) URLを入力してください');
        patch.url = value.href;
      }
      save(object, patch, fresh); close(); return true;
    } catch (cause) {
      error.textContent = cause instanceof Error ? cause.message : String(cause);
      (url ?? text).focus(); return false;
    }
  }
  document.addEventListener('pointerdown', event => {
    if (!active || active.panel.contains(event.target as Node)) return;
    if (!commit()) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  return {
    isActive: () => !!active, reposition, cancel: close,
    open(object: DeskObject, fresh = false) {
      if (active && !commit()) return;
      const panel = document.createElement('div'); panel.className = 'inline-editor';
      const text = document.createElement('textarea'); text.dataset.inlineText = ''; text.rows = 3;
      text.setAttribute('aria-label', object.type === 'label' ? 'ピンの説明文' : ['image', 'svg'].includes(object.type) ? 'タイトル' : ['link', 'web'].includes(object.type) ? '表示名' : 'テキスト');
      if (['image', 'svg'].includes(object.type)) text.placeholder = 'タイトル';
      text.value = object.type === 'label' ? object.description ?? '' : object.text;
      panel.append(text);
      let url: HTMLInputElement | undefined;
      if (['link', 'web', 'image', 'svg'].includes(object.type)) {
        url = document.createElement('input'); url.type = 'url'; url.dataset.inlineUrl = '';
        const optional = ['image', 'svg'].includes(object.type);
        url.setAttribute('aria-label', optional ? 'HTTP(S) URL（任意）' : 'HTTP(S) URL');
        url.placeholder = optional ? 'リンク先URL（任意）https://' : 'https://'; url.value = object.url ?? ''; panel.append(url);
      }
      const hint = document.createElement('small'); hint.textContent = 'Enter：確定 · Shift＋Enter：改行 · Esc：取消'; panel.append(hint);
      const error = document.createElement('div'); error.className = 'editor-error'; error.setAttribute('role', 'alert'); panel.append(error);
      active = { object, fresh, panel, text, url, error }; workspace.append(panel); reposition();
      panel.addEventListener('compositionstart', () => { composing = true; });
      panel.addEventListener('compositionend', () => { composing = false; });
      panel.addEventListener('keydown', event => {
        event.stopPropagation();
        if (event.isComposing || composing || event.keyCode === 229) return;
        if (event.key === 'Escape') { event.preventDefault(); close(); }
        if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); commit(); }
      });
      text.focus(); text.select();
    },
  };
}
