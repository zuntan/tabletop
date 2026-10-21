import { stickerShapeNames, stickerShapeIds } from './sticker-shapes';
import { stickerGlyph } from './sticker-glyphs';
import type { DeskObject, Operation } from './model';
import { objectSchema } from './model';
import { createColorControls } from './color-controls';
import { addNumberPresets, addPresetPalette } from './number-presets';
import { stickerOperations, stickerSchema, stickerTarget, type StickerShape, type Stickers } from './sticker-values';

export function createStickerControls(form: HTMLElement, selected:()=>DeskObject[], apply:(operations:Operation[])=>void, report:(message:string,error?:boolean)=>void) {
  const box = document.createElement('fieldset'); box.id='sticker-controls'; box.hidden=true;
  const heading=document.createElement('legend');heading.textContent='シール';
  const colors=document.createElement('div');colors.className='sticker-colors';
  const add=document.createElement('button');add.type='button';add.id='sticker-add';add.textContent='追加';add.setAttribute('aria-label','シールを追加');
  const clear=document.createElement('button');clear.type='button';clear.id='sticker-clear';clear.textContent='全消し';clear.setAttribute('aria-label','シールを全消し');
  const actions=document.createElement('div');actions.className='sticker-actions';const shape=document.createElement('select');shape.id='sticker-shape';shape.setAttribute('aria-label','追加するシールの形');
  for(const [value,label] of Object.entries(stickerShapeNames)){const option=document.createElement('option');option.value=value;option.textContent=label;shape.append(option);}
  const appearance=document.createElement('div');appearance.className='sticker-appearance';appearance.append(colors,shape);actions.append(appearance,add,clear);
  const shapePicker=addPresetPalette(shape,stickerShapeIds,'シールの形');shape.hidden=true;
  shapePicker.menu.id='sticker-shape-menu';shapePicker.menu.textContent='▼';shapePicker.wrapper.classList.add('sticker-shape-picker');
  shapePicker.popup.classList.add('sticker-shape-palette');
  for(const button of shapePicker.choices.querySelectorAll<HTMLButtonElement>('button')){
    const id=button.dataset.value as StickerShape;button.replaceChildren(stickerGlyph(id));
    button.title=stickerShapeNames[id];button.setAttribute('aria-label',stickerShapeNames[id]);
  }
  shape.onchange=()=>update();
  const originLabel=document.createElement('label');originLabel.textContent='配置起点';
  const origin=document.createElement('select');origin.id='sticker-origin';origin.setAttribute('aria-label','シールの配置起点');
  const names={'top-left':'左上','top-right':'右上','bottom-left':'左下','bottom-right':'右下'};
  const mixed=document.createElement('option');mixed.value='';mixed.textContent='複数';mixed.disabled=true;origin.append(mixed);
  for(const [value,name] of Object.entries(names)){const option=document.createElement('option');option.value=value;option.textContent=name;origin.append(option);}originLabel.append(origin);
  const diameterLabel=document.createElement('label');diameterLabel.textContent='直径';
  const diameter=document.createElement('input');diameter.type='number';diameter.id='sticker-diameter';diameter.min='1';diameter.max='100000';diameter.step='any';diameter.setAttribute('aria-label','シールの直径');diameterLabel.append(diameter);
  const fixedLabel=document.createElement('label');fixedLabel.className='sticker-fixed';
  const fixed=document.createElement('input');fixed.type='checkbox';fixed.id='sticker-fixed';fixedLabel.append(fixed,'ズーム固定');
  box.append(heading,actions,originLabel,diameterLabel,fixedLabel);form.after(box);
  addNumberPresets(diameter,[24,36,48,64,80,100],'シールの直径');
  const picker=addPresetPalette(origin,Object.keys(names),'シールの配置起点');origin.hidden=true;picker.wrapper.classList.add('line-style-picker');
  for(const button of picker.choices.querySelectorAll<HTMLButtonElement>('button')){button.textContent=names[button.dataset.value as keyof typeof names];button.setAttribute('aria-label',button.textContent);}
  let ink='#ef4444';
  const colorPicker=createColorControls(colors,operations=>{
    const operation=operations[0];if(operation?.kind==='update'&&typeof operation.patch.fill==='string'){ink=operation.patch.fill;update();}
  },'sticker-',{roles:['fill'],names:{fill:'シール'},allowTransparent:false});
  const commit=(action:Parameters<typeof stickerOperations>[1])=>{
    try{const operations=stickerOperations(selected(),action);if(operations.length)apply(operations);update();}
    catch(error){update();report(error instanceof Error?error.message:String(error),true);}
  };
  add.onclick=()=>commit({kind:'append',color:ink,shape:shape.value as StickerShape});clear.onclick=()=>commit({kind:'clear'});
  origin.onchange=()=>commit({kind:'settings',patch:{origin:origin.value as Stickers['origin']}});
  diameter.onchange=()=>commit({kind:'settings',patch:{diameter:Number(diameter.value)}});
  diameter.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();diameter.blur();}});
  fixed.onchange=()=>commit({kind:'settings',patch:{fixed:fixed.checked}});
  box.addEventListener('keydown',event=>event.stopPropagation());
  function update(){
    const objects=selected().filter(stickerTarget);box.hidden=!objects.length;
    const configs=objects.map(object=>stickerSchema.parse(object.stickers??{}));
    const one=<K extends keyof Stickers>(key:K)=>configs.length&&configs.every(c=>c[key]===configs[0][key])?configs[0][key]:undefined;
    origin.value=one('origin')??'';picker.menu.textContent=names[origin.value as keyof typeof names]??'複数';
    diameter.value=one('diameter')===undefined?'':String(one('diameter'));diameter.placeholder='複数';
    fixed.indeterminate=one('fixed')===undefined;fixed.checked=one('fixed')??false;
    add.disabled=!objects.length;clear.disabled=!configs.some(config=>config.items.length);
    colorPicker.update([objectSchema.parse({id:'sticker-ink',type:'text',fill:ink})]);
    const trigger=colors.querySelector<HTMLButtonElement>('.color-trigger')!;
    trigger.querySelector('[data-sticker-shape]')?.remove();trigger.prepend(stickerGlyph(shape.value as StickerShape,ink));
    trigger.title=`シールの色：${ink}／${stickerShapeNames[shape.value as StickerShape]}`;
  }
  return{update};
}
