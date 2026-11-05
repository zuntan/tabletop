import { t, languageChangeEvent } from './i18n';
import { uiText, uiAttribute } from './i18n/dom';
import { stickerShapeName } from './badge-labels';
import { stationerySplitButton } from './stationery-split-button';
import { stickerGlyph } from './sticker-glyphs';
import type { DeskObject, Operation } from './model';
import { createStickerChoicePicker } from './sticker-choice-picker';
import { addNumberPresets, addPresetPalette } from './number-presets';
import { stickerOperations, stickerSchema, stickerTarget, type StickerShape, type Stickers } from './sticker-values';

export function createStickerControls(form: HTMLElement, selected:()=>DeskObject[], apply:(operations:Operation[])=>void, report:(message:string,error?:boolean)=>void, toolbar:HTMLElement) {
  const box = document.createElement('fieldset'); box.id='sticker-controls'; box.hidden=true;
  const heading=document.createElement('legend');uiText(heading,'badges:sticker');
  const {button:repeat,menu:trigger}=stationerySplitButton('sticker');
  let last:{kind:'append';column:1|2;color:string;shape:StickerShape}={kind:'append',column:1,color:'#ef4444',shape:'circle'};
  const showLastShape=()=>{const icon=stickerGlyph(last.shape);icon.setAttribute('width','18');icon.setAttribute('height','18');repeat.replaceChildren(icon);};
  showLastShape();
  let repeated=false;
  const repeatTitle=()=>{repeat.title=repeated?t('badges:repeatSticker',{column:last.column,shape:stickerShapeName(last.shape),color:last.color}):t('badges:defaultSticker');};
  repeatTitle();
  repeat.onclick=()=>commit(last);
  const panel=document.createElement('div');panel.id='sticker-palette';panel.popover='auto';panel.setAttribute('role','group');uiAttribute(panel,'aria-label','badges:stickerActions');
  trigger.popoverTargetElement=panel;trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls',panel.id);
  toolbar.append(repeat,trigger);document.body.append(panel);
  toolbar.addEventListener('keydown',event=>{if(event.code==='Space')event.stopPropagation();});
  const title=document.createElement('div');title.className='sticker-palette-title';uiText(title,'badges:sticker');panel.append(title);
  const position=()=>{const r=trigger.getBoundingClientRect();panel.style.left=`${Math.max(8,Math.min(r.left,innerWidth-panel.offsetWidth-8))}px`;panel.style.top=`${Math.max(8,Math.min(r.bottom+6,innerHeight-panel.offsetHeight-8))}px`;};
  panel.addEventListener('toggle',()=>{const open=panel.matches(':popover-open');trigger.setAttribute('aria-expanded',String(open));if(open)position();});
  panel.addEventListener('keydown',event=>event.stopPropagation());
  window.addEventListener('resize',()=>{if(panel.matches(':popover-open'))position();});
  const rows=([1,2] as const).map(column=>{
    const suffix=column===1?'':'-2';
    let ink='#ef4444',shape:StickerShape='circle';
    const add=document.createElement('button');add.type='button';add.id='sticker-add'+suffix;add.className='sticker-preview-add';add.setAttribute('aria-label',t('badges:addColumn',{column}));
    const clear=document.createElement('button');clear.type='button';clear.id='sticker-clear'+suffix;uiText(clear,'badges:clear');clear.setAttribute('aria-label',t('badges:clearColumn',{column}));
    const actions=document.createElement('div');actions.className='sticker-actions';actions.setAttribute('role','group');actions.setAttribute('aria-label',t('badges:column',{column}));
    const label=document.createElement('span');label.className='sticker-column-number';label.textContent=String(column);label.title=t('badges:column',{column});
    document.addEventListener(languageChangeEvent,()=>{actions.setAttribute('aria-label',t('badges:column',{column}));label.title=t('badges:column',{column});});
    const choice=createStickerChoicePicker(panel,suffix,()=>({color:ink,shape}),patch=>{ink=patch.color??ink;shape=patch.shape??shape;update();});
    actions.append(label,add,choice.menu,clear);panel.append(actions);
    add.onclick=()=>commit({kind:'append',column,color:ink,shape});clear.onclick=()=>commit({kind:'clear',column});
    return{add,clear,get ink(){return ink;},get shape(){return shape;},column};
  });
  const originLabel=document.createElement('label');originLabel.append(uiText(document.createElement('span'),'badges:origin'));
  const origin=document.createElement('select');origin.id='sticker-origin';uiAttribute(origin,'aria-label','badges:stickerOrigin');
  const names={'top-left':'badges:corners.top-left','top-right':'badges:corners.top-right','bottom-left':'badges:corners.bottom-left','bottom-right':'badges:corners.bottom-right'} as const;
  const mixed=document.createElement('option');mixed.value='';uiText(mixed,'badges:mixed');mixed.disabled=true;origin.append(mixed);
  for(const [value,name] of Object.entries(names)){const option=document.createElement('option');option.value=value;uiText(option,name);origin.append(option);}originLabel.append(origin);
  const diameterLabel=document.createElement('label');diameterLabel.append(uiText(document.createElement('span'),'badges:diameter'));
  const diameter=document.createElement('input');diameter.type='number';diameter.id='sticker-diameter';diameter.min='1';diameter.max='100000';diameter.step='any';uiAttribute(diameter,'aria-label','badges:stickerDiameter');diameterLabel.append(diameter);
  const fixedLabel=document.createElement('label');fixedLabel.className='sticker-fixed';
  const fixed=document.createElement('input');fixed.type='checkbox';fixed.id='sticker-fixed';fixedLabel.append(fixed,uiText(document.createElement('span'),'badges:fixed'));
  box.prepend(heading);box.append(originLabel,diameterLabel,fixedLabel);form.after(box);
  addNumberPresets(diameter,[24,36,48,64,80,100],t('badges:stickerDiameter'),'badges:stickerDiameter');
  const picker=addPresetPalette(origin,Object.keys(names),t('badges:stickerOrigin'),'badges:stickerOrigin');origin.hidden=true;picker.wrapper.classList.add('line-style-picker');
  for(const button of picker.choices.querySelectorAll<HTMLButtonElement>('button')){uiText(button,names[button.dataset.value as keyof typeof names]);uiAttribute(button,'aria-label',names[button.dataset.value as keyof typeof names]);}
  const commit=(action:Parameters<typeof stickerOperations>[1])=>{
    try{const operations=stickerOperations(selected(),action);if(operations.length){apply(operations);if(action.kind==='append'){last={kind:'append',column:action.column??1,color:action.color,shape:action.shape??'circle'};showLastShape();repeated=true;repeatTitle();}}update();}
    catch(error){update();report(error instanceof Error?error.message:String(error),true);}
  };
  origin.onchange=()=>commit({kind:'settings',patch:{origin:origin.value as Stickers['origin']}});
  diameter.onchange=()=>commit({kind:'settings',patch:{diameter:Number(diameter.value)}});
  diameter.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();diameter.blur();}});
  fixed.onchange=()=>commit({kind:'settings',patch:{fixed:fixed.checked}});
  box.addEventListener('keydown',event=>event.stopPropagation());
  function update(){
    const objects=selected().filter(stickerTarget);box.hidden=!objects.length;repeat.disabled=!objects.length;trigger.disabled=!objects.length;
    const configs=objects.map(object=>stickerSchema.parse(object.stickers??{}));
    const one=<K extends keyof Stickers>(key:K)=>configs.length&&configs.every(c=>c[key]===configs[0][key])?configs[0][key]:undefined;
    origin.value=one('origin')??'';uiText(picker.menu,names[origin.value as keyof typeof names]??'badges:mixed');
    diameter.value=one('diameter')===undefined?'':String(one('diameter'));uiAttribute(diameter,'placeholder','badges:mixed');
    fixed.indeterminate=one('fixed')===undefined;fixed.checked=one('fixed')??false;
    for(const {add,clear,shape,ink,column} of rows){
      add.disabled=!objects.length;clear.disabled=!configs.some(config=>(column===1?config.items:config.items2??[]).length);
      add.replaceChildren(stickerGlyph(shape,ink));add.title=t('badges:addSticker',{column,shape:stickerShapeName(shape),color:ink});
    }
  }
  document.addEventListener(languageChangeEvent,()=>{repeatTitle();for(const row of rows){row.add.setAttribute('aria-label',t('badges:addColumn',{column:row.column}));row.clear.setAttribute('aria-label',t('badges:clearColumn',{column:row.column}));}update();});
  return{update};
}
