import { t } from './i18n';
import { uiText, uiAttribute } from './i18n/dom';
import {addPresetPalette} from './number-presets';
import {reactionPlacements,reactionPositions,type ReactionPlacement} from './reaction-layout';

export function createReactionPlacementPicker(box:HTMLElement,change:(value:ReactionPlacement)=>void){
 const label=document.createElement('label');label.append(uiText(document.createElement('span'),'badges:placement'));
 const select=document.createElement('select');select.id='reaction-placement';select.hidden=true;uiAttribute(select,'aria-label','badges:reactionPlacement');
 const mixed=document.createElement('option');mixed.value='';uiText(mixed,'badges:mixed');mixed.disabled=true;select.append(mixed);
 for(const value of reactionPlacements){const option=document.createElement('option');option.value=value;uiText(option,`badges:placements.${value}`);select.append(option);}
 label.append(select);box.append(label);
 const picker=addPresetPalette(select,reactionPlacements,t('badges:reactionPlacement'),'badges:reactionPlacement');picker.menu.id='reaction-placement-menu';picker.popup.classList.add('reaction-placement-palette');
 const buttons=[...picker.choices.querySelectorAll<HTMLButtonElement>('button')];
 const ns='http://www.w3.org/2000/svg';
 for(const button of buttons){
  const value=button.dataset.value as ReactionPlacement,icon=document.createElementNS(ns,'svg');icon.setAttribute('viewBox','0 0 52 38');icon.setAttribute('aria-hidden','true');
  const body=document.createElementNS(ns,'rect');for(const [key,v] of Object.entries({x:14,y:10,width:24,height:18,rx:2,fill:'none',stroke:'#64748b','stroke-width':1}))body.setAttribute(key,String(v));icon.append(body);
  for(const point of reactionPositions(192,144,3,value)){
   const dot=document.createElementNS(ns,'rect');for(const [key,v] of Object.entries({x:14+point.x/8,y:10+point.y/8,width:3,height:3,rx:.7,fill:'#3b82f6'}))dot.setAttribute(key,String(v));icon.append(dot);
  }
  const caption=document.createElement('span');uiText(caption,`badges:placements.${value}`);button.replaceChildren(icon,caption);uiAttribute(button,'aria-label',`badges:placements.${value}`);uiAttribute(button,'title',`badges:placements.${value}`);
 }
 for(const corner of ['top-left','top-right','bottom-left','bottom-right']){
  const group=document.createElement('div');group.className='reaction-corner-options';group.append(...buttons.filter(button=>button.dataset.value!.startsWith(corner)));picker.choices.append(group);
 }
 select.onchange=()=>{if(select.value)change(select.value as ReactionPlacement);};
 return {update(value:ReactionPlacement|undefined){select.value=value??'';uiText(picker.menu,value?`badges:placementShort.${value}`:'badges:mixed');uiAttribute(picker.menu,'title',value?`badges:placements.${value}`:'badges:mixed');}};
}
