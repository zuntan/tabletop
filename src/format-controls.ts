import type { Desk, Operation } from './model';
import { formatDefaults, formatPatch, extractFormat, formatStorageKey, readFormatMemory, supportsFormat } from './format-style';
import type { Appearance } from './settings';

export function createFormatControls(desk: Desk, toolbar: HTMLElement, apply: (operations: Operation[]) => void, report: (message: string, error?: boolean) => void) {
  let stored: string | null = null; try { stored = localStorage.getItem(formatStorageKey); } catch { /* Session-only memory still works. */ }
  const memory = readFormatMemory(stored);
  const persist = () => { try { localStorage.setItem(formatStorageKey, JSON.stringify(memory)); } catch { report('書式はこのタブで使えますが、ブラウザへ保存できません', true); } };
  // Common creation settings remain shared desk defaults; extras and the three snapshots are browser-local.
  const initial = formatDefaults(memory.current);
  if (Object.keys(initial).length) desk.execute({ actor: 'human', operations: [{ kind: 'defaults_update', patch: initial }] });
  let lastDefaults = '';
  const block = document.createElement('div'); block.className = 'format-control';
  const caption = document.createElement('small'); caption.textContent = '書式';
  const trigger = document.createElement('button'); trigger.id = 'format-open'; trigger.type = 'button'; trigger.textContent = '▾'; trigger.title = '保存した書式1〜3'; trigger.setAttribute('aria-label', '保存した書式1〜3を開く');
  const panel = document.createElement('div'); panel.id = 'format-palette'; panel.popover = 'auto'; panel.className = 'number-preset-palette'; panel.setAttribute('aria-label', '書式スポイト・適用');
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
      persist(); update(); report(capture ? `${index ? `書式${index}と現在` : '現在'}に書式を記憶しました` : '書式を適用し、現在の書式にも設定しました');
    } catch (error) { report(error instanceof Error ? error.message : String(error), true); }
  };
  for (let index = 0; index <= 3; index++) {
    const row = document.createElement('div'); row.className = 'format-row';
    const label = document.createElement('span'); label.textContent = index ? `書式${index}` : '現在';
    const capture = document.createElement('button'); capture.type = 'button'; capture.textContent = 'スポイト'; capture.id = `format-capture-${index}`; capture.setAttribute('aria-label', `${label.textContent}へ書式をスポイト`);
    const paste = document.createElement('button'); paste.type = 'button'; paste.textContent = '適用'; paste.id = `format-apply-${index}`; paste.setAttribute('aria-label', `${label.textContent}の書式を適用`);
    capture.onclick = () => action(index, true); paste.onclick = () => action(index, false);
    capture.title = capture.getAttribute('aria-label')!;
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
      row.paste.title = row.index > 0 && !memory.slots[row.index - 1] ? 'まだ書式を記憶していません' : '選択対象へ適用し、次の作成にも使います';
    }
  }
  return { update, appearance(type: string, defaults: Appearance) { return { ...defaults, ...formatPatch(memory.current, type), ...formatDefaults(defaults) }; } };
}
