import { createMarkdownPreview } from './markdown-preview';
import { shapeTypes } from './shape-definitions';
import { pinScreenObject } from './pin-series';
import type { DeskObject } from './model';
type EditorPatch = { text?: string; description?: string; url?: string; deskPath?:string; qrText?:string; mermaidSource?: string };

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
    let left=point.x-rect.left-inset,top=point.y-rect.top-inset;
    {
      const box=active.panel.getBoundingClientRect();
      const minX=Math.max(0,-rect.left)+8,minY=Math.max(0,-rect.top)+8;
      const maxX=Math.min(rect.width,innerWidth-rect.left)-8-box.width;
      const maxY=Math.min(rect.height,innerHeight-rect.top)-8-box.height;
      left=Math.max(minX,Math.min(left,maxX));top=Math.max(minY,Math.min(top,maxY));
    }
    Object.assign(active.panel.style, { left: `${left}px`, top: `${top}px` });
  }
  function commit() {
    if (!active) return true;
    const { object, text, url, source, fresh, error } = active;
    try {
      const patch: EditorPatch = object.type === 'label' ? { description: text.value } : { text: text.value };
      if(source){if(object.type==='qrcode')patch.qrText=source.value;else patch.mermaidSource=source.value;}
      if(url&&object.deskPath){
        const value=url.value.trim();if(!value.endsWith('.tabletop')||/[\x00-\x1f]/.test(value))throw new Error('.tabletopファイルのパスを入力してください');patch.deskPath=value;
      }else if (url && ['image', 'svg'].includes(object.type) && !url.value.trim()) patch.url = '';
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
      text.setAttribute('aria-label', object.type === 'label' ? 'ピンの説明文' : ['image', 'svg', 'mermaid', 'qrcode', 'prop', 'file'].includes(object.type) ? 'タイトル' : ['link', 'web'].includes(object.type) ? '表示名' : 'テキスト');
      if (['image', 'svg'].includes(object.type)) text.placeholder = 'タイトル';
      text.value = object.type === 'label' ? object.description ?? '' : object.text;
      panel.append(text);
      let source: HTMLTextAreaElement | undefined;
      if (object.type === 'mermaid'||object.type==='qrcode') {
        source = document.createElement('textarea'); source.rows = 10; source.spellcheck = false;
        if(object.type==='qrcode')source.dataset.inlineQr='';else source.dataset.inlineMermaid=''; source.setAttribute('aria-label',object.type==='qrcode'?'QRコードの内容':'Mermaidソース');
        source.value = (object.type==='qrcode'?object.qrText:object.mermaidSource) ?? ''; panel.append(source);
      }
      let url: HTMLInputElement | undefined;
      if (['link', 'web', 'image', 'svg'].includes(object.type)) {
        url = document.createElement('input'); url.type = object.deskPath?'text':'url'; url.dataset.inlineUrl = '';
        const optional = ['image', 'svg'].includes(object.type);
        url.setAttribute('aria-label', optional ? 'HTTP(S) URL（任意）' : 'HTTP(S) URL');
        url.placeholder = optional ? 'リンク先URL（任意）https://' : 'https://'; url.value = object.deskPath??object.url??'';if(object.deskPath){url.setAttribute('aria-label','机ファイルのパス');url.placeholder='.tabletopファイルのパス';} panel.append(url);
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
      let width = object.type === 'label' ? object.width : object.width * (matrix?.a ?? 1);
      const bounds=workspace.getBoundingClientRect();
      const availableWidth=Math.max(1,Math.min(bounds.right,innerWidth)-Math.max(bounds.left,0)-16);
      const availableHeight=Math.max(1,Math.min(bounds.bottom,innerHeight)-Math.max(bounds.top,0)-16);
      if(object.type==='text')width=Math.min(Math.max(1,availableWidth-20),Math.max(320,Math.min(800,width)));
      const matchesTextPart = textFrameTypes.has(object.type);
      const panelWidth=Math.min(availableWidth,matchesTextPart?width+20:Math.max(source?360:220,width));
      panel.style.width=`${panelWidth}px`;
      // Keep the resized field independent of its parent: width:100% plus the
      // observer below otherwise forms a parent/child sizing feedback loop.
      const fields=[text,...(source?[source]:[])];
      for(const field of fields)field.style.width=`${Math.max(1,panelWidth-20)}px`;
      if (matchesTextPart && matrix) text.style.height = `${object.height * matrix.d}px`;
      if(object.type==='text'){
        text.style.fontSize='16px';text.style.lineHeight='1.4';text.style.overflow='auto';
        text.style.height=`${Math.max(160,Math.min(480,object.height*(matrix?.d??1)))}px`;
      }
      const fieldWidths=new Map<HTMLTextAreaElement,number>();
      const resizeObserver=new ResizeObserver(entries=>{
        if(active?.text!==text)return;
        const resized=entries.map(entry=>entry.target as HTMLTextAreaElement).find(field=>fieldWidths.get(field)!==field.offsetWidth);
        if(resized){
          const nextWidth=resized.offsetWidth;
          for(const field of fields){fieldWidths.set(field,nextWidth);if(field!==resized)field.style.width=`${nextWidth}px`;}
          panel.style.width=`${nextWidth+20}px`;
        }
        reposition();
      });
      active = { object, fresh, panel, text, url, source, error, resizeObserver, disposePreview }; workspace.append(panel);
      if(object.type==='text'){
        const overhead=panel.getBoundingClientRect().height-text.getBoundingClientRect().height;
        text.style.height=`${Math.max(1,Math.min(text.getBoundingClientRect().height,availableHeight-overhead))}px`;
      }
      for(const field of fields){fieldWidths.set(field,field.offsetWidth);resizeObserver.observe(field);}reposition();
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
      (source ?? text).focus({preventScroll:true}); (source ?? text).select();
    },
  };
}
