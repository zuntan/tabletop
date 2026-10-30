import { stationerySplitButton } from './stationery-split-button';
import { stickerShapeNames } from './sticker-shapes';
import { stickerGlyph } from './sticker-glyphs';
import type { DeskObject, Operation } from './model';
import { createStickerChoicePicker } from './sticker-choice-picker';
import { addNumberPresets, addPresetPalette } from './number-presets';
import { stickerOperations, stickerSchema, stickerTarget, type StickerShape, type Stickers } from './sticker-values';

export function createStickerControls(form: HTMLElement, selected:()=>DeskObject[], apply:(operations:Operation[])=>void, report:(message:string,error?:boolean)=>void, toolbar:HTMLElement) {
  const box = document.createElement('fieldset'); box.id='sticker-controls'; box.hidden=true;
  const heading=document.createElement('legend');heading.textContent='シール';
  const {button:repeat,menu:trigger}=stationerySplitButton('sticker','シール');
  let last:{kind:'append';column:1|2;color:string;shape:StickerShape}={kind:'append',column:1,color:'#ef4444',shape:'circle'};
  const showLastShape=()=>{const icon=stickerGlyph(last.shape);icon.setAttribute('width','18');icon.setAttribute('height','18');repeat.replaceChildren(icon);};
  showLastShape();
  repeat.title='シール：列1へ赤丸を追加';
  repeat.onclick=()=>commit(last);
  const panel=document.createElement('div');panel.id='sticker-palette';panel.popover='auto';panel.setAttribute('role','group');panel.setAttribute('aria-label','シールの追加・削除');
  trigger.popoverTargetElement=panel;trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls',panel.id);
  toolbar.append(repeat,trigger);document.body.append(panel);
  toolbar.addEventListener('keydown',event=>{if(event.code==='Space')event.stopPropagation();});
  const title=document.createElement('div');title.className='sticker-palette-title';title.textContent='シール';panel.append(title);
  const position=()=>{const r=trigger.getBoundingClientRect();panel.style.left=`${Math.max(8,Math.min(r.left,innerWidth-panel.offsetWidth-8))}px`;panel.style.top=`${Math.max(8,Math.min(r.bottom+6,innerHeight-panel.offsetHeight-8))}px`;};
  panel.addEventListener('toggle',()=>{const open=panel.matches(':popover-open');trigger.setAttribute('aria-expanded',String(open));if(open)position();});
  panel.addEventListener('keydown',event=>event.stopPropagation());
  window.addEventListener('resize',()=>{if(panel.matches(':popover-open'))position();});
  const rows=([1,2] as const).map(column=>{
    const suffix=column===1?'':'-2';
    let ink='#ef4444',shape:StickerShape='circle';
    const add=document.createElement('button');add.type='button';add.id='sticker-add'+suffix;add.className='sticker-preview-add';add.setAttribute('aria-label','シール列'+column+'へ追加');
    const clear=document.createElement('button');clear.type='button';clear.id='sticker-clear'+suffix;clear.textContent='全消し';clear.setAttribute('aria-label','シール列'+column+'を全消し');
    const actions=document.createElement('div');actions.className='sticker-actions';actions.setAttribute('role','group');actions.setAttribute('aria-label','シール列'+column);
    const label=document.createElement('span');label.className='sticker-column-number';label.textContent=String(column);label.title='シール列'+column;
    const choice=createStickerChoicePicker(panel,suffix,()=>({color:ink,shape}),patch=>{ink=patch.color??ink;shape=patch.shape??shape;update();});
    actions.append(label,add,choice.menu,clear);panel.append(actions);
    add.onclick=()=>commit({kind:'append',column,color:ink,shape});clear.onclick=()=>commit({kind:'clear',column});
    return{add,clear,get ink(){return ink;},get shape(){return shape;},column};
  });
  const originLabel=document.createElement('label');originLabel.textContent='配置起点';
  const origin=document.createElement('select');origin.id='sticker-origin';origin.setAttribute('aria-label','シールの配置起点');
  const names={'top-left':'左上','top-right':'右上','bottom-left':'左下','bottom-right':'右下'};
  const mixed=document.createElement('option');mixed.value='';mixed.textContent='複数';mixed.disabled=true;origin.append(mixed);
  for(const [value,name] of Object.entries(names)){const option=document.createElement('option');option.value=value;option.textContent=name;origin.append(option);}originLabel.append(origin);
  const diameterLabel=document.createElement('label');diameterLabel.textContent='直径';
  const diameter=document.createElement('input');diameter.type='number';diameter.id='sticker-diameter';diameter.min='1';diameter.max='100000';diameter.step='any';diameter.setAttribute('aria-label','シールの直径');diameterLabel.append(diameter);
  const fixedLabel=document.createElement('label');fixedLabel.className='sticker-fixed';
  const fixed=document.createElement('input');fixed.type='checkbox';fixed.id='sticker-fixed';fixedLabel.append(fixed,'ズーム固定');
  box.prepend(heading);box.append(originLabel,diameterLabel,fixedLabel);form.after(box);
  addNumberPresets(diameter,[24,36,48,64,80,100],'シールの直径');
  const picker=addPresetPalette(origin,Object.keys(names),'シールの配置起点');origin.hidden=true;picker.wrapper.classList.add('line-style-picker');
  for(const button of picker.choices.querySelectorAll<HTMLButtonElement>('button')){button.textContent=names[button.dataset.value as keyof typeof names];button.setAttribute('aria-label',button.textContent);}
  const commit=(action:Parameters<typeof stickerOperations>[1])=>{
    try{const operations=stickerOperations(selected(),action);if(operations.length){apply(operations);if(action.kind==='append'){last={kind:'append',column:action.column??1,color:action.color,shape:action.shape??'circle'};showLastShape();repeat.title=`シール：列${last.column}へ${stickerShapeNames[last.shape]}（${last.color}）を追加`;}}update();}
    catch(error){update();report(error instanceof Error?error.message:String(error),true);}
  };
  origin.onchange=()=>commit({kind:'settings',patch:{origin:origin.value as Stickers['origin']}});
  diameter.onchange=()=>commit({kind:'settings',patch:{diameter:Number(diameter.value)}});
  diameter.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();diameter.blur();}});
  fixed.onchange=()=>commit({kind:'settings',patch:{fixed:fixed.checked}});
  box.addEventListener('keydown',event=>event.stopPropagation());
  function update(){
    const objects=selected().filter(stickerTarget);box.hidden=!objects.length;repeat.disabled=!objects.length;
    const configs=objects.map(object=>stickerSchema.parse(object.stickers??{}));
    const one=<K extends keyof Stickers>(key:K)=>configs.length&&configs.every(c=>c[key]===configs[0][key])?configs[0][key]:undefined;
    origin.value=one('origin')??'';picker.menu.textContent=names[origin.value as keyof typeof names]??'複数';
    diameter.value=one('diameter')===undefined?'':String(one('diameter'));diameter.placeholder='複数';
    fixed.indeterminate=one('fixed')===undefined;fixed.checked=one('fixed')??false;
    for(const {add,clear,shape,ink,column} of rows){
      add.disabled=!objects.length;clear.disabled=!configs.some(config=>(column===1?config.items:config.items2??[]).length);
      add.replaceChildren(stickerGlyph(shape,ink));add.title=`シール列${column}へ追加：${stickerShapeNames[shape]}（${ink}）`;
    }
  }
  return{update};
}
