import { t, languageChangeEvent } from './i18n';
import { uiText, uiAttribute } from './i18n/dom';
import { stampCaption } from './badge-labels';
import type { DeskObject, Operation } from './model';
import { createStamp, stampPatterns } from './stamp-values';
import { stampArtwork } from './stamps';
import { stationerySplitButton } from './stationery-split-button';

export function createStampControls(container: HTMLElement, selected: () => DeskObject[], apply: (ops: Operation[]) => void | boolean) {
  const {button:repeat,menu:trigger}=stationerySplitButton('stamp');
  let last={designId:'done_ja',dated:false};
  const repeatTitle = () => { repeat.title=t('badges:repeatStamp',{name:stampCaption(last.designId),date:last.dated?t('badges:withDate'):''}); };
  const panel = document.createElement('div'); panel.id = 'stamp-palette'; panel.popover = 'auto';
  uiAttribute(panel,'aria-label','badges:stampList');
  trigger.popoverTargetElement = panel;
  const dated = document.createElement('input'); dated.type = 'checkbox'; dated.id = 'stamp-dated';
  const datedKey='tabletop.stamp.dated';
  try{dated.checked=localStorage.getItem(datedKey)==='true';}catch{/* Keep an in-memory preference when storage is unavailable. */}
  last.dated=dated.checked;repeatTitle();
  const label = document.createElement('label'); label.append(dated, uiText(document.createElement('span'),'badges:dated'));
  const choices = document.createElement('div'); choices.className = 'stamp-choices';
  const categories = [
    {ids:['done_ja','done_en','on_hold_ja','on_hold_en','unread_ja','unread_en','read_ja','read_en','pass_ja','pass_en','fail_ja','fail_en','rejected_ja','rejected_en','physical_checked_ja','handle_with_care_ja']},
    {ids:['sealed_ja','sealed_en','confidential_ja','confidential_en','do_not_remove_ja','keep_secret_ja']},
    {ids:['hanamaru_ja','smile_ja','well_done_ja','keep_going_ja','nandeyanen_ja','shirangana_ja','wanted_ja','wanted_en','copy_paste_only_ja','copy_paste_only_en']},
  ];
  const palettePatterns=categories.flatMap(category=>category.ids.map(id=>stampPatterns.find(pattern=>pattern.id===id)!));
  const detail=document.createElement('div');detail.className='stamp-detail';
  const sample=document.createElementNS('http://www.w3.org/2000/svg','svg');sample.id='stamp-sample';sample.setAttribute('aria-hidden','true');
  const sampleName=document.createElement('div');sampleName.id='stamp-sample-name';sampleName.setAttribute('aria-live','polite');
  const sampleBox=document.createElement('div');sampleBox.className='stamp-sample-box';sampleBox.append(sample,sampleName);detail.append(sampleBox);
  let active=palettePatterns[0];
  const show=(pattern:typeof active)=>{
    active=pattern;sample.setAttribute('viewBox',pattern.shape==='square'?'-110 -57 220 114':'-58 -58 116 116');
    sample.replaceChildren(stampArtwork(createStamp(pattern.id,dated.checked)));sampleName.textContent=stampCaption(pattern.id);
    for(const button of choices.querySelectorAll<HTMLButtonElement>('[data-stamp-design]'))button.classList.toggle('stamp-previewed',button.dataset.stampDesign===pattern.id);
  };
  dated.onchange=()=>{try{localStorage.setItem(datedKey,String(dated.checked));}catch{/* Applying stamps still works without storage. */}show(active);};
  const press=(designId:string,withDate:boolean)=>{
    const targets=selected().filter(o=>['text','file'].includes(o.type));if(!targets.length)return;
    const stamp=createStamp(designId,withDate);
    if(apply(targets.map(o=>({kind:'update',id:o.id,patch:{stamp}})))===false)return;
    last={designId,dated:withDate};repeatTitle();
  };
  repeat.onclick=()=>press(last.designId,last.dated);
  const buttons = palettePatterns.map(pattern => {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.stampDesign = pattern.id;
    const translate = () => {button.title=stampCaption(pattern.id);button.setAttribute('aria-label',t('badges:pressStamp',{name:stampCaption(pattern.id)}));};
    translate();document.addEventListener(languageChangeEvent,translate);
    const preview = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    preview.setAttribute('viewBox', pattern.shape==='square'?'-110 -57 220 114':'-58 -58 116 116'); preview.setAttribute('aria-hidden', 'true');
    preview.append(stampArtwork({ designId: pattern.id, text: '', angle: -6 }));
    button.append(preview);choices.append(button);
    button.onpointerenter=()=>show(pattern);button.onfocus=()=>show(pattern);
    button.onclick = () => {
      show(pattern);
      press(pattern.id,dated.checked);
    };
    return button;
  });
  const clear = document.createElement('button'); clear.id = 'stamp-clear'; clear.type = 'button'; uiText(clear,'badges:clearStamp');
  clear.onclick = () => apply(selected().filter(o => ['text','file'].includes(o.type) && o.stamp).map(o => ({ kind: 'update', id: o.id, patch: { stamp: null } })));
  const actions=document.createElement('div');actions.className='stamp-actions';actions.append(label,clear);detail.append(actions);show(active);
  panel.append(choices, detail); container.append(repeat, trigger, panel);
  const position = () => {
    const rect = trigger.getBoundingClientRect();
    panel.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - panel.offsetWidth - 8))}px`;
    panel.style.top = `${Math.max(8, Math.min(rect.bottom + 6, innerHeight - panel.offsetHeight - 8))}px`;
  };
  panel.addEventListener('toggle', () => { const open = panel.matches(':popover-open'); trigger.setAttribute('aria-expanded', String(open)); if (open) position(); });
  window.addEventListener('resize', position);
  container.addEventListener('keydown', event => { if (event.code === 'Space') event.stopPropagation(); });
  document.addEventListener(languageChangeEvent,()=>{repeatTitle();show(active);});
  return { update(objects: DeskObject[]) {
    const texts = objects.filter(o => ['text','file'].includes(o.type));
    repeat.disabled=!texts.length;trigger.disabled=!texts.length;
    buttons.forEach(button => { button.disabled = !texts.length; });
    clear.disabled = !texts.some(o => o.stamp);
  } };
}
