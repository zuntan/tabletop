import { paletteColors } from './color-palettes';
import { stickerShapeIds, stickerShapeNames, type StickerShape } from './sticker-shapes';
import { stickerGlyph } from './sticker-glyphs';
import { createIcon } from './icons';

type Choice={color:string;shape:StickerShape};
export function createStickerChoicePicker(parent:HTMLElement,suffix:string,current:()=>Choice,change:(patch:Partial<Choice>)=>void){
 const menu=document.createElement('button');menu.type='button';menu.id='sticker-shape-menu'+suffix;menu.className='sticker-choice-open';menu.append(createIcon('chevron-down',12));menu.title='シールの色・型';menu.setAttribute('aria-label',menu.title);menu.setAttribute('aria-haspopup','dialog');
 const popup=document.createElement('div');popup.className='sticker-choice-palette sticker-shape-palette';popup.popover='auto';popup.setAttribute('role','dialog');popup.setAttribute('aria-label','シールの色・型');popup.id='sticker-choice-palette'+suffix;parent.append(popup);menu.popoverTargetElement=popup;menu.setAttribute('aria-controls',popup.id);
 const tabs=document.createElement('div');tabs.className='sticker-choice-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','シールの候補');
 const choices=document.createElement('div');choices.className='sticker-choice-grid';choices.setAttribute('role','tabpanel');choices.id=popup.id+'-choices';
 let mode:'recommended'|'all'|'shape'='shape';
 const buttons=([['shape','シールの型'],['recommended','おすすめカラー'],['all','全色カラー']] as const).map(([value,label])=>{
  const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('role','tab');button.id=popup.id+'-'+value;button.setAttribute('aria-controls',choices.id);
  button.onclick=()=>{mode=value;update();position();};tabs.append(button);return{button,value};
 });
 tabs.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const i=buttons.findIndex(b=>b.value===mode),next=event.key==='Home'?0:event.key==='End'?2:(i+(event.key==='ArrowRight'?1:2))%3;buttons[next].button.click();buttons[next].button.focus();};
 popup.append(tabs,choices);
 function update(){
  const value=current();
  buttons.forEach(({button,value})=>{button.setAttribute('aria-selected',String(value===mode));button.tabIndex=value===mode?0:-1;});choices.setAttribute('aria-labelledby',popup.id+'-'+mode);choices.dataset.mode=mode;choices.replaceChildren();
  for(const id of mode==='shape'?stickerShapeIds:paletteColors('sticker',mode)){
   const button=document.createElement('button');button.type='button';button.dataset.value=id;
   if(mode==='shape'){button.append(stickerGlyph(id as StickerShape,value.color));button.title=stickerShapeNames[id as StickerShape];button.setAttribute('aria-pressed',String(value.shape===id));}
   else{button.style.backgroundColor=id;button.title='シール '+id;button.setAttribute('aria-pressed',String(value.color===id));}
   button.setAttribute('aria-label',button.title);
   button.onclick=()=>{change(mode==='shape'?{shape:id as StickerShape}:{color:id});update();[...choices.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.dataset.value===id)?.focus({preventScroll:true});};choices.append(button);
  }
 }
 function position(){const r=menu.getBoundingClientRect();popup.style.left=`${Math.max(8,Math.min(r.left,innerWidth-popup.offsetWidth-8))}px`;popup.style.top=`${Math.max(8,Math.min(r.bottom+6,innerHeight-popup.offsetHeight-8))}px`;}
 popup.addEventListener('beforetoggle',event=>{if((event as ToggleEvent).newState==='open')update();});
 popup.addEventListener('toggle',()=>{const open=popup.matches(':popover-open');menu.setAttribute('aria-expanded',String(open));if(open)position();});
 popup.addEventListener('keydown',event=>event.stopPropagation());window.addEventListener('resize',()=>{if(popup.matches(':popover-open'))position();});
 update();
 return{menu};
}
