import { createMarkdownPreview } from './markdown-preview';
import { shapeTypes } from './shape-definitions';
import { pinScreenObject } from './pin-series';
import type { DeskObject } from './model';
type EditorPatch = { text?: string; description?: string; url?: string; mermaidSource?: string };

export function createInlineEditor(workspace: HTMLElement, viewport: SVGGElement,
  save: (object: DeskObject, patch: EditorPatch, fresh: boolean) => void) {
  let active: { object: DeskObject; fresh: boolean; panel: HTMLDivElement; text: HTMLTextAreaElement; url?: HTMLInputElement; source?: HTMLTextAreaElement; error: HTMLElement; resizeObserver?: ResizeObserver; disposePreview?: () => void } | null = null;
  let composing = false;
  const textFrameTypes = new Set(['text', ...shapeTypes]);
  let submitMode: 'enter' | 'mod-enter' = 'enter';
  try { if (localStorage.getItem('tabletop.editor.submit-key') === 'mod-enter') submitMode = 'mod-enter'; }
  catch { /* Keep the in-memory preference when browser storage is unavailable. */ }
  function close() { active?.disposePreview?.(); active?.resizeObserver?.disconnect(); active?.panel.remove(); active = null; composing = false; }
  function reposition() {
    if (!active) return;
    const matrix = viewport.getScreenCTM(); if (!matrix) return;
    const object = pinScreenObject(active.object, matrix.a);
    const point = new DOMPoint(object.x, object.y).matrixTransform(matrix);
    const rect = workspace.getBoundingClientRect();
    const inset = textFrameTypes.has(active.object.type) ? 10 : 0;
    Object.assign(active.panel.style, { left: `${point.x - rect.left - inset}px`, top: `${point.y - rect.top - inset}px` });
  }
  function commit() {
    if (!active) return true;
    const { object, text, url, source, fresh, error } = active;
    try {
      const patch: EditorPatch = object.type === 'label' ? { description: text.value } : { text: text.value };
      if (source) patch.mermaidSource = source.value;
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
      text.setAttribute('aria-label', object.type === 'label' ? 'ピンの説明文' : ['image', 'svg', 'mermaid', 'prop'].includes(object.type) ? 'タイトル' : ['link', 'web'].includes(object.type) ? '表示名' : 'テキスト');
      if (['image', 'svg'].includes(object.type)) text.placeholder = 'タイトル';
      text.value = object.type === 'label' ? object.description ?? '' : object.text;
      panel.append(text);
      let source: HTMLTextAreaElement | undefined;
      if (object.type === 'mermaid') {
        source = document.createElement('textarea'); source.rows = 10; source.spellcheck = false;
        source.dataset.inlineMermaid = ''; source.setAttribute('aria-label', 'Mermaidソース');
        source.value = object.mermaidSource ?? ''; panel.append(source);
      }
      let url: HTMLInputElement | undefined;
      if (['link', 'web', 'image', 'svg'].includes(object.type)) {
        url = document.createElement('input'); url.type = 'url'; url.dataset.inlineUrl = '';
        const optional = ['image', 'svg'].includes(object.type);
        url.setAttribute('aria-label', optional ? 'HTTP(S) URL（任意）' : 'HTTP(S) URL');
        url.placeholder = optional ? 'リンク先URL（任意）https://' : 'https://'; url.value = object.url ?? ''; panel.append(url);
      }
      const hint = document.createElement('small'); hint.id = 'inline-editor-hint'; hint.setAttribute('aria-live', 'polite');
      text.setAttribute('aria-describedby', hint.id);
      const actions = document.createElement('div'); actions.className = 'inline-editor-actions';
      const mode = document.createElement('button'); mode.type = 'button'; mode.textContent = '⇄';
      mode.className = 'editor-mode-toggle'; mode.setAttribute('aria-label', 'Enter改行モード');
      const updateHint = () => {
        hint.textContent = !source && submitMode === 'enter'
          ? 'Enter：確定 · Shift＋Enter：改行 · Esc：取消' : 'Enter：改行 · Ctrl/⌘＋Enter：確定 · Esc：取消';
        mode.setAttribute('aria-pressed', String(submitMode === 'mod-enter'));
        mode.title = submitMode === 'enter' ? 'Enterで改行する方式へ切替' : 'Enterで確定する方式へ切替';
      };
      mode.onclick = () => {
        if (composing) return;
        submitMode = submitMode === 'enter' ? 'mod-enter' : 'enter'; updateHint();
        try { localStorage.setItem('tabletop.editor.submit-key', submitMode); } catch { /* Session-only fallback. */ }
        text.focus();
      };
      mode.setAttribute('aria-describedby', hint.id);
      actions.append(hint); if (!source) actions.append(mode); panel.append(actions); updateHint();
      const disposePreview = object.type === 'text' ? createMarkdownPreview(panel, text, actions) : undefined;
      const error = document.createElement('div'); error.className = 'editor-error'; error.setAttribute('role', 'alert'); panel.append(error);
      const matrix = viewport.getScreenCTM();
      const width = object.type === 'label' ? object.width : object.width * (matrix?.a ?? 1);
      const matchesTextPart = textFrameTypes.has(object.type);
      panel.style.width = `${matchesTextPart ? width + 20 : Math.max(object.type === 'mermaid' ? 360 : 220, width)}px`;
      if (matchesTextPart && matrix) text.style.height = `${object.height * matrix.d}px`;
      const resizeObserver = matchesTextPart ? new ResizeObserver(() => {
        if (active?.text === text) panel.style.width = `${text.offsetWidth + 20}px`;
      }) : undefined;
      active = { object, fresh, panel, text, url, source, error, resizeObserver, disposePreview }; workspace.append(panel);
      resizeObserver?.observe(text); reposition();
      panel.addEventListener('compositionstart', () => { composing = true; });
      panel.addEventListener('compositionend', () => { composing = false; });
      panel.addEventListener('keydown', event => {
        event.stopPropagation();
        if (event.isComposing || composing || event.keyCode === 229) return;
        if (event.key === 'Escape') { event.preventDefault(); close(); }
        if ((event.target as Element).closest('select,button')) return;
        if (event.key === 'Enter' && !event.shiftKey && (!source && submitMode === 'enter' || event.ctrlKey || event.metaKey)) {
          event.preventDefault(); commit();
        }
      });
      (source ?? text).focus(); (source ?? text).select();
    },
  };
}
