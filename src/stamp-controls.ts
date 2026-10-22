import type { DeskObject, Operation } from './model';
import { createStamp, stampPatterns } from './stamp-values';
import { stampArtwork } from './stamps';
import { stationeryButton } from './stationery-button';

export function createStampControls(container: HTMLElement, selected: () => DeskObject[], apply: (ops: Operation[]) => void) {
  const trigger = document.createElement('button'); trigger.id = 'stamp-open'; trigger.textContent = 'ハンコ ▾';
  trigger.type = 'button'; trigger.setAttribute('aria-label', 'ハンコ一覧');
  stationeryButton(trigger, 'stamp', 'ハンコ一覧');
  const panel = document.createElement('div'); panel.id = 'stamp-palette'; panel.popover = 'auto';
  panel.setAttribute('aria-label', 'ハンコ一覧');
  trigger.popoverTargetElement = panel;
  const dated = document.createElement('input'); dated.type = 'checkbox'; dated.id = 'stamp-dated';
  const label = document.createElement('label'); label.append(dated, ' 日付付き');
  const choices = document.createElement('div'); choices.className = 'stamp-choices';
  const paletteOrder = ['done_ja', 'sealed_ja', 'rejected_ja', 'on_hold_ja',
    'done_en', 'sealed_en', 'rejected_en', 'on_hold_en',
    'handle_with_care_ja', 'hanamaru_ja', 'smile_ja', 'well_done_ja',
    'keep_going_ja', 'nandeyanen_ja', 'shirangana_ja'];
  // English handling artwork remains valid in saved data and the AI pattern list.
  const palettePatterns = paletteOrder.map(id => stampPatterns.find(pattern => pattern.id === id)!);
  const buttons = palettePatterns.map(pattern => {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.stampDesign = pattern.id;
    button.title = pattern.caption; button.setAttribute('aria-label', `${pattern.caption}を押す`);
    const preview = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    preview.setAttribute('viewBox', '-110 -55 220 110'); preview.setAttribute('aria-hidden', 'true');
    preview.append(stampArtwork({ designId: pattern.id, text: '', angle: -6 }));
    const caption = document.createElement('span'); caption.textContent = pattern.caption;
    button.append(preview, caption); choices.append(button);
    button.onclick = () => {
      const stamp = createStamp(pattern.id, dated.checked);
      apply(selected().filter(o => ['text','file'].includes(o.type)).map(o => ({ kind: 'update', id: o.id, patch: { stamp } })));
    };
    return button;
  });
  const clear = document.createElement('button'); clear.id = 'stamp-clear'; clear.type = 'button'; clear.textContent = '取り消し';
  clear.onclick = () => apply(selected().filter(o => ['text','file'].includes(o.type) && o.stamp).map(o => ({ kind: 'update', id: o.id, patch: { stamp: null } })));
  choices.append(clear); panel.append(label, choices); container.append(trigger, panel);
  const position = () => {
    const rect = trigger.getBoundingClientRect();
    panel.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - panel.offsetWidth - 8))}px`;
    panel.style.top = `${Math.max(8, Math.min(rect.bottom + 6, innerHeight - panel.offsetHeight - 8))}px`;
  };
  panel.addEventListener('toggle', () => { const open = panel.matches(':popover-open'); trigger.setAttribute('aria-expanded', String(open)); if (open) position(); });
  window.addEventListener('resize', position);
  container.addEventListener('keydown', event => { if (event.code === 'Space') event.stopPropagation(); });
  return { update(objects: DeskObject[]) {
    const texts = objects.filter(o => ['text','file'].includes(o.type));
    buttons.forEach(button => { button.disabled = !texts.length; });
    clear.disabled = !texts.some(o => o.stamp);
  } };
}
