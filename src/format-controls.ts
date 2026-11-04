import { t, languageChangeEvent } from './i18n';
import { uiText, uiAttribute } from './i18n/dom';
import type { Desk, Operation } from './model';
import { formatDefaults, formatPatch, extractFormat, formatStorageKey, readFormatMemory, supportsFormat } from './format-style';
import type { Appearance } from './settings';

export function createFormatControls(desk: Desk, toolbar: HTMLElement, apply: (operations: Operation[]) => void, report: (message: string, error?: boolean) => void) {
  let stored: string | null = null; try { stored = localStorage.getItem(formatStorageKey); } catch { /* Session-only memory still works. */ }
  const memory = readFormatMemory(stored);
  const persist = () => { try { localStorage.setItem(formatStorageKey, JSON.stringify(memory)); } catch { report(t('paint:localOnly'), true); } };
  // Common creation settings remain shared desk defaults; extras and the three snapshots are browser-local.
  const initial = formatDefaults(memory.current);
  if (Object.keys(initial).length) desk.execute({ actor: 'human', operations: [{ kind: 'defaults_update', patch: initial }] });
  let lastDefaults = '';
  const block = document.createElement('div'); block.className = 'format-control';
  const caption = document.createElement('small'); uiText(caption, 'paint:format');
  const trigger = document.createElement('button'); trigger.id = 'format-open'; trigger.type = 'button'; trigger.textContent = '▾'; uiAttribute(trigger, 'title', 'paint:slotsTitle'); uiAttribute(trigger, 'aria-label', 'paint:openSlots');
  const panel = document.createElement('div'); panel.id = 'format-palette'; panel.popover = 'auto'; panel.className = 'number-preset-palette'; uiAttribute(panel, 'aria-label', 'paint:formatPanel');
  trigger.popoverTargetElement = panel;
  const rows: { index: number; capture: HTMLButtonElement; paste: HTMLButtonElement }[] = [];
  const action = (index: number, capture: boolean) => {
    const objects = desk.selected().map(id => desk.get(id));
    try {
      const style = capture ? extractFormat(objects[0]) : index === 0 ? memory.current : memory.slots[index - 1];
      if (!style) return;
      const operations: Operation[] = [];
      if (Object.keys(formatDefaults(style)).length) operations.push({ kind: 'defaults_update', patch: formatDefaults(style) });
      if (!capture) for (const object of objects) {
        const patch = formatPatch(style, object.type);
        if (Object.keys(patch).length) operations.push({ kind: 'update', id: object.id, patch });
      }
      if (operations.length) apply(operations);
      if (capture && index) memory.slots[index - 1] = structuredClone(style);
      memory.current = { ...desk.settingsSnapshot().defaults, ...style };
      persist(); update(); report(capture ? (index ? t('paint:rememberSlot', { index }) : t('paint:rememberCurrent')) : t('paint:applied'));
    } catch (error) { report(error instanceof Error ? error.message : String(error), true); }
  };
  for (let index = 0; index <= 3; index++) {
    const row = document.createElement('div'); row.className = 'format-row';
    const label = document.createElement('span'); label.textContent = index ? t('paint:slot', { index }) : t('paint:current');
    const capture = document.createElement('button'); capture.type = 'button'; uiText(capture, 'paint:pick'); capture.id = `format-capture-${index}`; capture.setAttribute('aria-label', t('paint:captureLabel', { name: label.textContent }));
    const paste = document.createElement('button'); paste.type = 'button'; uiText(paste, 'paint:apply'); paste.id = `format-apply-${index}`; paste.setAttribute('aria-label', t('paint:applyLabel', { name: label.textContent }));
    capture.onclick = () => action(index, true); paste.onclick = () => action(index, false);
    capture.title = capture.getAttribute('aria-label')!;
    const translate = () => {
      label.textContent = index ? t('paint:slot', { index }) : t('paint:current');
      capture.setAttribute('aria-label', t('paint:captureLabel', { name: label.textContent }));
      capture.title = capture.getAttribute('aria-label')!;
      paste.setAttribute('aria-label', t('paint:applyLabel', { name: label.textContent }));
    };
    document.addEventListener(languageChangeEvent, translate);
    rows.push({ index, capture, paste });
    if (index === 0) { row.classList.add('format-current'); row.append(capture, paste, trigger); block.append(caption, row); }
    else { row.append(label, capture, paste); panel.append(row); }
  }
  toolbar.querySelector('#default-opacity')?.closest('label')?.after(block); document.body.append(panel);
  panel.addEventListener('toggle', () => {
    const open = panel.matches(':popover-open'); trigger.setAttribute('aria-expanded', String(open));
    if (open) { update(); const rect = trigger.getBoundingClientRect(), left = rows[0].capture.getBoundingClientRect().left; panel.style.left = `${Math.max(8, Math.min(left, innerWidth - panel.offsetWidth - 8))}px`; panel.style.top = `${Math.max(8, Math.min(rect.bottom + 6, innerHeight - panel.offsetHeight - 8))}px`; }
  });
  panel.addEventListener('keydown', event => event.stopPropagation());
  function update() {
    const defaults = desk.settingsSnapshot().defaults, serialized = JSON.stringify(defaults);
    if (serialized !== lastDefaults) { lastDefaults = serialized; memory.current = { ...memory.current, ...defaults }; persist(); }
    const selected = desk.selected().map(id => desk.get(id));
    for (const row of rows) {
      row.capture.disabled = selected.length !== 1 || !supportsFormat(selected[0]?.type);
      row.paste.disabled = !selected.some(object => supportsFormat(object.type)) || (row.index > 0 && !memory.slots[row.index - 1]);
      row.paste.title = row.index > 0 && !memory.slots[row.index - 1] ? t('paint:emptySlot') : t('paint:applyHint');
    }
  }
  return { update, appearance(type: string, defaults: Appearance) { return { ...defaults, ...formatPatch(memory.current, type), ...formatDefaults(defaults) }; } };
}
