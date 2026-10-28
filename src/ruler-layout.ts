import type {DeskObject,Operation} from './model';
import {isShapeType} from './shape-definitions';
import {randomUuid} from './portable-crypto';

export const rulerTarget=(o:DeskObject)=>isShapeType(o.type)||['text','image','svg','mermaid', 'qrcode','web','link'].includes(o.type);
export const rulerFor=(scene:DeskObject[],id:string)=>scene.find(o=>o.type==='ruler'&&(o.id===id||o.rulerMembers?.some(m=>m.id===id)));
export function rulerGroup(scene:DeskObject[],id:string):DeskObject[]{const r=rulerFor(scene,id);return r?[...scene.filter(o=>r.rulerMembers?.some(m=>m.id===o.id)),r]:scene.filter(o=>o.id===id);}
export const rulerVertical=(r:DeskObject)=>r.rulerAxis==='vertical';
const filed=(scene:DeskObject[],id:string)=>scene.find(o=>o.type==='file'&&o.fileMembers?.includes(id));
const clipped=(scene:DeskObject[],id:string)=>scene.some(o=>o.type==='clip'&&o.clipMembers?.includes(id));
export function rulerCreateOperations(scene:DeskObject[],ids:string[],point:{x:number;y:number}):Operation[]{
 const objects=ids.map(id=>scene.find(o=>o.id===id)!);
 if(objects.some(o=>!o||!rulerTarget(o)||rulerFor(scene,o.id)||filed(scene,o.id)||clipped(scene,o.id)||o.locked))throw Error('束・ファイルに属さないカードや図形を選んでください');
 const x=objects.length?Math.min(...objects.map(o=>o.x))-36:point.x;
 const y=objects.length?Math.min(...objects.map(o=>o.y)):point.y;
 const length=objects.length?Math.max(120,...objects.map(o=>o.y+o.height-y)):480;
 return [{kind:'add',object:{id:'ruler-'+randomUuid(),type:'ruler',x,y,width:36,height:length,rulerAxis:'vertical',rulerThickness:36,rulerMode:'free',rulerMaterial:'acrylic',rulerMembers:objects.map(o=>({id:o.id,side:'after' as const})),text:'定規'}}];
}
/** Single owner, stable member order, and zoom-independent world coordinates. */
export function resolveRulers(input:DeskObject[],before:DeskObject[]=[]):DeskObject[]{
 const map=new Map(input.map(o=>[o.id,{...o}])),prior=new Map(before.map(o=>[o.id,o])),owners=new Map<string,string>();
 for(const source of input.filter(o=>o.type==='ruler')){
  const r=map.get(source.id)!,old=prior.get(r.id);
  const members=r.rulerMembers??[];
  if(old?.rulerMembers?.some(m=>!map.has(m.id))){map.delete(r.id);continue;}
  if(new Set(members.map(m=>m.id)).size!==members.length)throw Error('Duplicate ruler member');
  for(const m of members){const o=map.get(m.id);if(!o||!rulerTarget(o))throw Error('Invalid ruler member');if(owners.has(m.id)||clipped(input,m.id))throw Error('A card can belong to only one layout container');owners.set(m.id,r.id);
   const f=filed(input,m.id),rf=filed(input,r.id);if(f?.id!==rf?.id)throw Error('定規と所属カード全体を同じファイルへ入れてください');}
  const thickness=r.rulerThickness??36;
  const axis=r.width===r.height?(old?.rulerAxis??r.rulerAxis??'horizontal'):(r.width>r.height?'horizontal':'vertical');
  r.rulerAxis=axis;r.rulerThickness=thickness;r.rulerMode??='free';r.rulerMaterial??='acrylic';r.rulerMembers=members;
  const vertical=rulerVertical(r),length=Math.max(120,thickness+1,vertical?r.height:r.width);
  r.width=vertical?thickness:length;r.height=vertical?length:thickness;
  const group=[r,...members.map(m=>map.get(m.id)!)];
  if(group.some(o=>o.locked!==undefined)){const locked=group.some(o=>o.locked);for(const o of group)o.locked=locked;}
  // A clear file owns geometry while stored; it has already translated the complete bundle.
  if(filed(input,r.id))continue;
  const oldVertical=old?rulerVertical(old):vertical,axisChanged=!!old&&oldVertical!==vertical;
  const origin=vertical?r.y:r.x,oldOrigin=old?(oldVertical?old.y:old.x):origin;
  const delta=old?origin-oldOrigin:0;
  for(const side of ['before','after'] as const){
   const list=members.filter(m=>m.side===side).map(m=>map.get(m.id)!);if(!list.length)continue;
   const sizes=list.map(o=>vertical?o.height:o.width),sum=sizes.reduce((a,b)=>a+b,0);
   const gap=list.length>1?(length-sum)/(list.length-1):0;
   const centerStep=list.length>1?Math.max(4,(length-(sizes[0]+sizes.at(-1)!)/2)/(list.length-1)):0;
   let position=origin,previousCenter=-Infinity;
   for(let i=0;i<list.length;i++){
    const o=list[i],previous=prior.get(o.id);let along:number;
    if(r.rulerMode==='free'){
     if(axisChanged&&previous)along=origin+(oldVertical?previous.y:previous.x)-oldOrigin;
     else along=(vertical?o.y:o.x)+(previous&&old&&(vertical?o.y===previous.y:o.x===previous.x)?delta:0);
    }else if(r.rulerMode==='center')along=origin+sizes[0]/2+i*centerStep-sizes[i]/2;
    else {along=position;const center=along+sizes[i]/2;if(i&&center<previousCenter+4)along=previousCenter+4-sizes[i]/2;position=along+sizes[i]+gap;}
    previousCenter=along+sizes[i]/2;
    const x=vertical?(side==='before'?r.x-o.width:r.x+r.width):along;
    const y=vertical?along:(side==='before'?r.y-o.height:r.y+r.height);
    const dx=x-o.x,dy=y-o.y;o.x=x;o.y=y;
    if(o.callout&&!o.callout.binding)o.callout={...o.callout,x:o.callout.x+dx,y:o.callout.y+dy};
   }
  }
 }
 const result:DeskObject[]=[],emitted=new Set<string>();
 for(const source of input){const o=map.get(source.id);if(!o)continue;const owner=owners.get(o.id)??(o.type==='ruler'?o.id:undefined);if(owner&&map.has(owner)){
  if(emitted.has(owner))continue;emitted.add(owner);const r=map.get(owner)!;for(const m of r.rulerMembers??[])result.push(map.get(m.id)!);result.push(r);
 }else result.push(o);}
 return result;
}
export function assertRulerOperation(scene:DeskObject[],op:Operation,actor:string){
 if(!('id'in op))return;const r=rulerFor(scene,op.id);if(!r)return;
 const structural=op.kind==='delete'||op.kind==='update'&&Object.keys(op.patch).some(k=>['x','y','width','height','rulerMembers','rulerMode','rulerThickness','rulerAxis'].includes(k));
 if(actor==='human'&&structural&&rulerGroup(scene,op.id).some(o=>o.locked))throw Error('定規の束をロック解除してください');
 if(filed(scene,r.id)&&(op.kind==='delete'||op.kind==='update'&&Object.keys(op.patch).some(k=>k.startsWith('ruler'))))throw Error('ファイル内の定規は変更・削除できません');
}
export function rulerDropTarget(scene:DeskObject[],point:{x:number;y:number},zoom:number,exclude:string[]=[]){
 let best:{ruler:DeskObject;side:'before'|'after';distance:number}|undefined;
 for(const r of scene.filter(o=>o.type==='ruler'&&!o.locked&&!filed(scene,o.id)&&!exclude.includes(o.id))){
  const vertical=rulerVertical(r),along=vertical?point.y:point.x,start=vertical?r.y:r.x,length=vertical?r.height:r.width;
  if(along<start-18/zoom||along>start+length+18/zoom)continue;
  for(const side of ['before','after'] as const){const edge=vertical?r.x+(side==='after'?r.width:0):r.y+(side==='after'?r.height:0),distance=Math.abs((vertical?point.x:point.y)-edge);
   if(distance<=18/zoom&&(!best||distance<best.distance))best={ruler:r,side,distance};}
 }return best;
}
export function rulerMoveOperations(scene:DeskObject[],ids:string[],dx:number,dy:number,detach:boolean,point:{x:number;y:number},zoom:number):Operation[]|null{
 const selected=scene.filter(o=>ids.includes(o.id)),updates=new Map<string,Partial<DeskObject>>();let handled=false;
 const put=(id:string,patch:Partial<DeskObject>)=>updates.set(id,{...updates.get(id),...patch});
 for(const o of selected){const owner=rulerFor(scene,o.id);if(!owner)continue;handled=true;
  if(o.id===owner.id){put(o.id,{x:o.x+dx,y:o.y+dy});continue;}
  let members=[...(updates.get(owner.id)?.rulerMembers??owner.rulerMembers??[])];
  if(detach){members=members.filter(m=>m.id!==o.id);put(owner.id,{rulerMembers:members});put(o.id,{x:o.x+dx,y:o.y+dy});continue;}
  if(ids.includes(owner.id))continue;
  const vertical=rulerVertical(owner),next=(vertical?o.y+dy:o.x+dx);
  if(owner.rulerMode==='free')put(o.id,vertical?{y:next}:{x:next});
  else {const member=members.find(m=>m.id===o.id)!;const same=members.filter(m=>m.side===member.side&&m.id!==o.id);const center=next+(vertical?o.height:o.width)/2;let index=same.findIndex(m=>{const t=scene.find(t=>t.id===m.id)!;return (vertical?t.y+t.height/2:t.x+t.width/2)>center;});if(index<0)index=same.length;same.splice(index,0,member);let i=0;members=members.map(m=>m.side===member.side?same[i++]:m);put(owner.id,{rulerMembers:members});}
 }
 if(!handled&&selected.length===1&&!detach&&rulerTarget(selected[0])&&!filed(scene,selected[0].id)&&!clipped(scene,selected[0].id)){
  const hit=rulerDropTarget(scene,point,zoom,ids);if(hit){handled=true;const o=selected[0];put(o.id,{x:o.x+dx,y:o.y+dy});put(hit.ruler.id,{rulerMembers:[...hit.ruler.rulerMembers??[],{id:o.id,side:hit.side}]});}
 }
 if(!handled)return null;
 for(const o of selected)if(!rulerFor(scene,o.id)&&!updates.has(o.id))put(o.id,{x:o.x+dx,y:o.y+dy,
  ...(o.type==='line'?{x2:(o.x2??o.x+o.width)+dx,y2:(o.y2??o.y+o.height)+dy,startBinding:o.startBinding&&ids.includes(o.startBinding.objectId)?o.startBinding:null,endBinding:o.endBinding&&ids.includes(o.endBinding.objectId)?o.endBinding:null}:{}),
  ...(o.type==='label'&&o.attachment&&!ids.includes(o.attachment.objectId)?{attachment:null}:{}),
  ...(o.callout&&!o.callout.binding?{callout:{...o.callout,x:o.callout.x+dx,y:o.callout.y+dy}}:{})});
 return [...updates].map(([id,patch])=>({kind:'update' as const,id,patch}));
}
