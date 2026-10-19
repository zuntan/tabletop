import type { Desk, DeskObject } from './model';
import { syncProperties, propertyValue, propertyFieldPatch } from './properties';

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
const isControl = (value: unknown): value is Control => value instanceof HTMLInputElement || value instanceof HTMLTextAreaElement || value instanceof HTMLSelectElement;

/** Drafts are local; commit one field per edit, never an unrelated field's pending text. */
export function createPropertyEditor(form: HTMLFormElement, desk: Desk,
  apply: (id: string, patch: Partial<DeskObject>) => void, report: (message: string) => void) {
  let shownId = '';
  const drafts = new Map<Control, { id: string; base: string; value: string }>();
  const composing = new Set<Control>();
  function restore(input: Control) {
    drafts.delete(input);
    try { input.value = propertyValue(desk.get(shownId), input.name); } catch { /* Target was removed. */ }
  }
  function commit(input: Control) {
    if (input.disabled || !input.name || composing.has(input)) return;
    const draft = drafts.get(input);
    if (!shownId || draft && draft.id !== shownId) { restore(input); return; }
    try {
      const object = desk.get(shownId);
      if (draft && propertyValue(object, input.name) !== draft.base) throw new Error('編集中にこの値が変更されました。最新の値を確認してください');
      if (!input.checkValidity()) throw new Error('入力値を確認してください');
      const patch = propertyFieldPatch(input.name, input.value, object);
      drafts.delete(input);
      if (Object.keys(patch).length) apply(object.id, patch);
    } catch (error) {
      restore(input); report(error instanceof Error ? error.message : String(error));
    }
  }
  form.addEventListener('input', event => {
    const input = event.target;
    if (!isControl(input) || !input.name || input.disabled || !shownId) return;
    const old = drafts.get(input);
    drafts.set(input, { id: shownId, base: old?.base ?? propertyValue(desk.get(shownId), input.name), value: input.value });
  });
  form.addEventListener('change', event => { if (isControl(event.target)) commit(event.target); });
  form.addEventListener('focusout', event => { if (isControl(event.target) && drafts.has(event.target)) commit(event.target); });
  form.addEventListener('compositionstart', event => { if (isControl(event.target)) composing.add(event.target); });
  form.addEventListener('compositionend', event => {
    if (!isControl(event.target)) return;
    composing.delete(event.target);
    if (document.activeElement !== event.target) commit(event.target);
  });
  form.addEventListener('keydown', event => {
    const input = event.target;
    if (!isControl(input) || event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Enter' && input instanceof HTMLInputElement && input.type === 'number') {
      event.preventDefault(); event.stopPropagation(); commit(input);
    } else if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); restore(input);
    }
  });
  // Commit before a canvas pointerdown changes selection and repopulates the form.
  document.addEventListener('pointerdown', event => {
    const active = document.activeElement;
    if (isControl(active) && form.contains(active) && drafts.has(active)
      && event.target instanceof Node && !form.contains(event.target)) commit(active);
  }, true);
  form.onsubmit = event => event.preventDefault();
  return {
    clear() { shownId = ''; drafts.clear(); composing.clear(); },
    sync(object: DeskObject) {
      if (shownId !== object.id) { drafts.clear(); composing.clear(); }
      shownId = object.id;
      const active = document.activeElement;
      const caret = active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement && active.type !== 'number'
        ? { start: active.selectionStart, end: active.selectionEnd } : null;
      syncProperties(form, object);
      for (const [input, draft] of drafts) {
        if (input.disabled) { drafts.delete(input); continue; }
        input.value = draft.value;
      }
      if (caret && isControl(active) && drafts.has(active) && !(active instanceof HTMLSelectElement) && caret.start !== null && caret.end !== null) {
        active.setSelectionRange(caret.start, caret.end);
      }
    },
  };
}
