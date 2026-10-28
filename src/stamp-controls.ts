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
  const categories = [
    {caption:'確認・判定',ids:['done_ja','done_en','on_hold_ja','on_hold_en','unread_ja','unread_en','read_ja','read_en','pass_ja','pass_en','fail_ja','fail_en','rejected_ja','rejected_en','physical_checked_ja','handle_with_care_ja']},
    {caption:'注意・機密',ids:['sealed_ja','sealed_en','confidential_ja','confidential_en','do_not_remove_ja','keep_secret_ja']},
    {caption:'気持ち・ひとこと',ids:['hanamaru_ja','smile_ja','well_done_ja','keep_going_ja','nandeyanen_ja','shirangana_ja','wanted_ja','wanted_en','copy_paste_only_ja','copy_paste_only_en']},
  ];
  const palettePatterns=categories.flatMap(category=>category.ids.map(id=>stampPatterns.find(pattern=>pattern.id===id)!));
  const detail=document.createElement('div');detail.className='stamp-detail';
  const sample=document.createElementNS('http://www.w3.org/2000/svg','svg');sample.id='stamp-sample';sample.setAttribute('aria-hidden','true');
  const sampleName=document.createElement('div');sampleName.id='stamp-sample-name';sampleName.setAttribute('aria-live','polite');
  const sampleBox=document.createElement('div');sampleBox.className='stamp-sample-box';sampleBox.append(sample,sampleName);detail.append(sampleBox);
  let active=palettePatterns[0];
  const show=(pattern:typeof active)=>{
    active=pattern;sample.setAttribute('viewBox',pattern.shape==='square'?'-110 -57 220 114':'-58 -58 116 116');
    sample.replaceChildren(stampArtwork(createStamp(pattern.id,dated.checked)));sampleName.textContent=pattern.caption;
    for(const button of choices.querySelectorAll<HTMLButtonElement>('[data-stamp-design]'))button.classList.toggle('stamp-previewed',button.dataset.stampDesign===pattern.id);
  };
  dated.onchange=()=>show(active);
  const buttons = palettePatterns.map(pattern => {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.stampDesign = pattern.id;
    button.title = pattern.caption; button.setAttribute('aria-label', `${pattern.caption}を押す`);
    const preview = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    preview.setAttribute('viewBox', pattern.shape==='square'?'-110 -57 220 114':'-58 -58 116 116'); preview.setAttribute('aria-hidden', 'true');
    preview.append(stampArtwork({ designId: pattern.id, text: '', angle: -6 }));
    button.append(preview);choices.append(button);
    button.onpointerenter=()=>show(pattern);button.onfocus=()=>show(pattern);
    button.onclick = () => {
      show(pattern);
      const stamp = createStamp(pattern.id, dated.checked);
      apply(selected().filter(o => ['text','file'].includes(o.type)).map(o => ({ kind: 'update', id: o.id, patch: { stamp } })));
    };
    return button;
  });
  const clear = document.createElement('button'); clear.id = 'stamp-clear'; clear.type = 'button'; clear.textContent = '取り消し';
  clear.onclick = () => apply(selected().filter(o => ['text','file'].includes(o.type) && o.stamp).map(o => ({ kind: 'update', id: o.id, patch: { stamp: null } })));
  const actions=document.createElement('div');actions.className='stamp-actions';actions.append(label,clear);detail.append(actions);show(active);
  panel.append(choices, detail); container.append(trigger, panel);
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
