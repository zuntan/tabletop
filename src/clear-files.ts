import type {DeskObject,Operation} from './model';
import {bounds,endpoints,isConnector} from './geometry';
import {clipFor,clipGroup} from './clip-bundles';
import {gridPoint} from './grid';
import type {GridSettings} from './grid-settings';
import {randomUuid} from './portable-crypto';

export const FILE_MARGIN=24, FILE_TITLE=34;
export const fileFor=(objects:DeskObject[],id:string)=>objects.find(o=>o.type==='file'&&(o.id===id||o.fileMembers?.includes(id)));
export const fileGroup=(objects:DeskObject[],id:string):DeskObject[]=>{
 const file=fileFor(objects,id);return file?[file,...objects.filter(o=>file.fileMembers?.includes(o.id))]:clipGroup(objects,id);
};
const differs=(a:number|undefined,b:number|undefined)=>a===undefined||b===undefined?a!==b:Math.abs(a-b)>1e-8;
const geometryKeys=['x','y','x2','y2','width','height','callout','startBinding','endBinding','startJunction','endJunction','cutout'] as const;
const structuralClip=['clipMembers','clipAnchor','clipOffset','clipOffsetMode','clipOffsetPercent','clipSize','clipAutoSize','clipStyle'];
export function fileCreateOperations(objects:DeskObject[],ids:string[],grid?:GridSettings):Operation[]{
 if(!ids.length)throw new Error('クリアファイルに入れるものを選択してください');
 const selected=ids.map(id=>objects.find(o=>o.id===id)!);
 if(selected.some(o=>!o||['label','prop'].includes(o.type)))throw new Error('ピン・小物はクリアファイルに入れられません。選択から外してください');
 if(selected.some(o=>fileFor(objects,o.id)))throw new Error('クリアファイルの入れ子・結合はできません。先に解除してください');
 const members=new Set(ids.flatMap(id=>clipGroup(objects,id).map(o=>o.id)));
 const contents=objects.filter(o=>members.has(o.id));
 if(contents.some(o=>o.locked))throw new Error('ロックを解除してからクリアファイルへ入れてください');
 if(contents.some(o=>o.type==='clip'&&!o.clipMembers?.length))throw new Error('空のクリップはクリアファイルに入れられません');
 const boxes=contents.map(bounds),x=Math.min(...boxes.map(b=>b.x))-FILE_MARGIN,y=Math.min(...boxes.map(b=>b.y))-FILE_MARGIN-FILE_TITLE;
 const corner={x:Math.max(...boxes.map(b=>b.x+b.width))+FILE_MARGIN,y:Math.max(...boxes.map(b=>b.y+b.height))+FILE_MARGIN};
 const origin=grid?.enabled?gridPoint({x,y},grid):{x,y},dx=origin.x-x,dy=origin.y-y;
 return [...(dx||dy?contents.map(o=>({kind:'update' as const,id:o.id,patch:translated(o,dx,dy)})):[]),{kind:'add',object:{id:'file-'+randomUuid(),type:'file',x:origin.x,y:origin.y,width:corner.x-x,height:corner.y-y,fileMembers:contents.map(o=>o.id),text:'クリアファイル',fill:'#93c5fd',fillOpacity:.12,stroke:'#6b91b8',strokeWidth:1.5,fontSize:14,textColor:'#243247'}}];
}
function translated(o:DeskObject,dx:number,dy:number):Partial<DeskObject>{
 const points=isConnector(o)?endpoints(o):undefined;
 return {x:o.x+dx,y:o.y+dy,...(points?{x:points.start.x+dx,y:points.start.y+dy,x2:points.end.x+dx,y2:points.end.y+dy}:{}),
 ...(o.callout?{callout:{...o.callout,x:o.callout.x+dx,y:o.callout.y+dy}}:{})};
}
export function assertFileOperation(scene:DeskObject[],operation:Operation){
 if(!('id' in operation)||!['update','delete','reorder'].includes(operation.kind))return;
 const file=fileFor(scene,operation.id);if(!file)return;
 const root=file.id===operation.id,object=scene.find(o=>o.id===operation.id)!;
 if(operation.kind==='delete'){
  if(!root&&clipFor(scene,object.id))throw new Error('ファイル内のクリップと紙は削除できません。先にファイルを解除してください');return;
 }
 if(operation.kind==='reorder'&&!root)throw new Error('ファイル内の前後関係は変更できません。先に解除してください');
 if(operation.kind!=='update')return;
 const keys=Object.keys(operation.patch);
 if(keys.some(k=>k==='fileMembers'||k==='width'||k==='height'||(!root&&structuralClip.includes(k))))throw new Error('ファイル内のサイズ・束の構造は変更できません。先に解除してください');
 if(!root&&keys.some(k=>geometryKeys.includes(k as typeof geometryKeys[number]))) {
  // Dragging a member is a translation of its enclosing file, not a geometry edit.
  const patch=operation.patch;
  if(keys.some(k=>!['x','y','x2','y2'].includes(k))||patch.x===undefined||patch.y===undefined)throw new Error('ファイル内の配置は固定されています。先に解除してください');
  if(isConnector(object)){
   const p=endpoints(object),dx=patch.x-p.start.x,dy=patch.y-p.start.y;
   if(patch.x2===undefined||patch.y2===undefined||Math.abs(patch.x2-p.end.x-dx)>1e-8||Math.abs(patch.y2-p.end.y-dy)>1e-8)throw new Error('ファイル内の端点は変更できません。先に解除してください');
  }
 }
}
/** Validate ownership, translate one whole file and preserve its contiguous z-order. */
export function resolveFiles(input:DeskObject[],before:DeskObject[]=[]):DeskObject[]{
 const map=new Map(input.map(o=>[o.id,{...o}])),previous=new Map(before.map(o=>[o.id,o])),owners=new Map<string,string>();
 for(const source of input.filter(o=>o.type==='file')){
  const file=map.get(source.id)!,old=previous.get(file.id);
  const members=(file.fileMembers??[]).filter(id=>{
   if(map.has(id))return true;
   if(old?.fileMembers?.includes(id))return false;
   throw new Error('クリアファイルの中身が見つかりません');
  });
  if(!members.length){if(old){map.delete(file.id);continue;}throw new Error('空のクリアファイルは作成できません');}
  if(new Set(members).size!==members.length)throw new Error('Duplicate file member');
  for(const id of members){const o=map.get(id)!;if(['file','prop','label'].includes(o.type))throw new Error('クリアファイルに入れられない種類です');if(owners.has(id))throw new Error('Multiple clear file ownership');owners.set(id,file.id);}
  for(const id of members){const c=clipFor(input,id);if(c&&(!c.clipMembers?.length||![c.id,...c.clipMembers].every(id=>members.includes(id))))throw new Error('クリップの束全体をクリアファイルへ入れてください');}
  file.fileMembers=members;
  if(!old)continue;
  let dx=file.x-old.x,dy=file.y-old.y;
  const moved=members.map(id=>({now:map.get(id)!,old:previous.get(id)})).filter(p=>p.old&&(differs(p.now.x,p.old.x)||differs(p.now.y,p.old.y)));
  if(!dx&&!dy&&moved.length){dx=moved[0].now.x-moved[0].old!.x;dy=moved[0].now.y-moved[0].old!.y;file.x=old.x+dx;file.y=old.y+dy;}
  if(moved.some(p=>Math.abs(p.now.x-p.old!.x-dx)>1e-8||Math.abs(p.now.y-p.old!.y-dy)>1e-8))throw new Error('ファイル内の相対位置は変更できません');
  if(dx||dy)for(const id of members){const o=map.get(id)!,prior=previous.get(id);if(!prior)continue;Object.assign(o,translated(prior,dx,dy));
   for(const field of ['startBinding','endBinding'] as const)if(o[field]&&!members.includes(o[field]!.objectId))o[field]=null;
   if(o.callout?.binding&&!members.includes(o.callout.binding.objectId))o.callout={...o.callout,binding:null};
  }
 }
 const emitted=new Set<string>(),result:DeskObject[]=[];
 for(const o of input){const object=map.get(o.id);if(!object)continue;const owner=owners.get(o.id)??(o.type==='file'?o.id:undefined);
  if(owner){if(emitted.has(owner))continue;emitted.add(owner);const f=map.get(owner)!;result.push(f,...f.fileMembers!.map(id=>map.get(id)!));}else result.push(object);
 }return result;
}
/** External constraints may follow a file but may never distort its contents. */
export function freezeFileGeometry(resolved:DeskObject[],fixed:DeskObject[]){
 const members=new Set(fixed.filter(o=>o.type==='file').flatMap(o=>o.fileMembers??[])),map=new Map(fixed.map(o=>[o.id,o]));let changed=false;
 const objects=resolved.map(o=>{if(!members.has(o.id))return o;const source=map.get(o.id)!;const next={...o};
  for(const field of ['x','y','x2','y2','width','height'] as const)if(differs(next[field],source[field])){changed=true;next[field]=source[field] as number;}
  if(isConnector(o))for(const [side,binding,junction] of [['start','startBinding','startJunction'],['end','endBinding','endJunction']] as const){const a=endpoints(o)[side],b=endpoints(source)[side];if(differs(a.x,b.x)||differs(a.y,b.y)){next[binding]=null;next[junction]=null;}}
  if(o.callout&&source.callout&&(differs(o.callout.x,source.callout.x)||differs(o.callout.y,source.callout.y))){next.callout={...source.callout,binding:null};changed=true;}
  return next;
 });return {objects,changed};
}
export function fileMoveOperations(scene:DeskObject[],ids:string[],dx:number,dy:number):Operation[]|null{
 if(!ids.some(id=>fileFor(scene,id)))return null;const done=new Set<string>(),ops:Operation[]=[];
 for(const id of ids){const file=fileFor(scene,id),object=file??scene.find(o=>o.id===id)!;if(done.has(object.id))continue;done.add(object.id);
  if(fileGroup(scene,id).some(o=>o.locked))continue;ops.push({kind:'update',id:object.id,patch:translated(object,dx,dy)});
 }return ops;
}
