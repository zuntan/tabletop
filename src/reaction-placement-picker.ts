import {addPresetPalette} from './number-presets';
import {reactionPlacements,reactionPlacementNames,reactionPositions,type ReactionPlacement} from './reaction-layout';

export function createReactionPlacementPicker(box:HTMLElement,change:(value:ReactionPlacement)=>void){
 const label=document.createElement('label');label.textContent='配置';
 const select=document.createElement('select');select.id='reaction-placement';select.hidden=true;select.setAttribute('aria-label','リアクションの配置');
 const mixed=document.createElement('option');mixed.value='';mixed.textContent='複数';mixed.disabled=true;select.append(mixed);
 for(const value of reactionPlacements){const option=document.createElement('option');option.value=value;option.textContent=reactionPlacementNames[value];select.append(option);}
 label.append(select);box.append(label);
 const picker=addPresetPalette(select,reactionPlacements,'リアクションの配置');picker.menu.id='reaction-placement-menu';picker.popup.classList.add('reaction-placement-palette');
 const buttons=[...picker.choices.querySelectorAll<HTMLButtonElement>('button')];
 const ns='http://www.w3.org/2000/svg';
 for(const button of buttons){
  const value=button.dataset.value as ReactionPlacement,icon=document.createElementNS(ns,'svg');icon.setAttribute('viewBox','0 0 52 38');icon.setAttribute('aria-hidden','true');
  const body=document.createElementNS(ns,'rect');for(const [key,v] of Object.entries({x:14,y:10,width:24,height:18,rx:2,fill:'none',stroke:'#64748b','stroke-width':1}))body.setAttribute(key,String(v));icon.append(body);
  for(const point of reactionPositions(192,144,3,value)){
   const dot=document.createElementNS(ns,'rect');for(const [key,v] of Object.entries({x:14+point.x/8,y:10+point.y/8,width:3,height:3,rx:.7,fill:'#3b82f6'}))dot.setAttribute(key,String(v));icon.append(dot);
  }
  const caption=document.createElement('span');caption.textContent=reactionPlacementNames[value];button.replaceChildren(icon,caption);button.setAttribute('aria-label',caption.textContent);button.title=caption.textContent;
 }
 for(const corner of ['top-left','top-right','bottom-left','bottom-right']){
  const group=document.createElement('div');group.className='reaction-corner-options';group.append(...buttons.filter(button=>button.dataset.value!.startsWith(corner)));picker.choices.append(group);
 }
 select.onchange=()=>{if(select.value)change(select.value as ReactionPlacement);};
 return {update(value:ReactionPlacement|undefined){select.value=value??'';picker.menu.textContent=value?reactionPlacementNames[value]:'複数';}};
}
