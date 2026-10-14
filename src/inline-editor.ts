import type { DeskObject } from './model';
type EditorPatch = { text?: string; description?: string; url?: string };

export function createInlineEditor(workspace: HTMLElement, viewport: SVGGElement,
  save: (object: DeskObject, patch: EditorPatch, fresh: boolean) => void) {
  let active: { object: DeskObject; fresh: boolean; panel: HTMLDivElement; text: HTMLTextAreaElement; url?: HTMLInputElement; error: HTMLElement } | null = null;
  let composing = false;
  let submitMode: 'enter' | 'mod-enter' = 'enter';
  try { if (localStorage.getItem('tabletop.editor.submit-key') === 'mod-enter') submitMode = 'mod-enter'; }
  catch { /* Keep the in-memory preference when browser storage is unavailable. */ }
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
      const hint = document.createElement('small'); panel.append(hint);
      const actions = document.createElement('div'); actions.className = 'inline-editor-actions';
      const mode = document.createElement('select'); mode.setAttribute('aria-label', '確定キー');
      mode.add(new Option('Enterで確定', 'enter')); mode.add(new Option('Ctrl/⌘＋Enterで確定（Enterは改行）', 'mod-enter'));
      mode.value = submitMode;
      const updateHint = () => { hint.textContent = submitMode === 'enter'
        ? 'Enter：確定 · Shift＋Enter：改行 · Esc：取消' : 'Enter：改行 · Ctrl/⌘＋Enter：確定 · Esc：取消'; };
      mode.onchange = () => {
        submitMode = mode.value === 'mod-enter' ? 'mod-enter' : 'enter'; updateHint();
        try { localStorage.setItem('tabletop.editor.submit-key', submitMode); } catch { /* Session-only fallback. */ }
        text.focus();
      };
      const confirm = document.createElement('button'); confirm.type = 'button'; confirm.textContent = '確定';
      confirm.onclick = () => { if (!composing) commit(); };
      actions.append(mode, confirm); panel.append(actions); updateHint();
      const error = document.createElement('div'); error.className = 'editor-error'; error.setAttribute('role', 'alert'); panel.append(error);
      active = { object, fresh, panel, text, url, error }; workspace.append(panel); reposition();
      panel.addEventListener('compositionstart', () => { composing = true; });
      panel.addEventListener('compositionend', () => { composing = false; });
      panel.addEventListener('keydown', event => {
        event.stopPropagation();
        if (event.isComposing || composing || event.keyCode === 229) return;
        if (event.key === 'Escape') { event.preventDefault(); close(); }
        if ((event.target as Element).closest('select,button')) return;
        if (event.key === 'Enter' && !event.shiftKey && (submitMode === 'enter' || event.ctrlKey || event.metaKey)) {
          event.preventDefault(); commit();
        }
      });
      text.focus(); text.select();
    },
  };
}
