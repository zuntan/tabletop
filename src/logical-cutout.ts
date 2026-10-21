import { z } from 'zod';
import type { DeskObject } from './model';
import { shapePaths, isShapeType } from './shape-definitions';
const size=z.number().finite().positive().max(100_000);
const relative=z.number().finite().min(-1e9).max(1e9);
export const cutoutSchema=z.object({enabled:z.boolean(),path:z.string().min(1).max(20_000),
  source:z.object({x:relative,y:relative,width:size,height:size}).strict(),
  layout:z.object({width:size,height:size}).strict()}).strict();
export const cutoutTarget=(object:DeskObject)=>['text','image','svg','mermaid','web'].includes(object.type);
export const cutoutTitle=(object:DeskObject)=>object.type==='text'?0:34;
export function bodyRect(object:DeskObject){const title=cutoutTitle(object);return{x:object.x,y:object.y+title,width:object.width,height:Math.max(0,object.height-title)};}
/** Actual source rectangle, in world units, even while only its window is visible. */
export function sourceRect(object:DeskObject){
 const b=bodyRect(object),c=object.cutout;
 return c?.enabled?{x:b.x+c.source.x*b.width,y:b.y+c.source.y*b.height,width:c.source.width*b.width,height:c.source.height*b.height}:b;
}
export function cutoutTogglePatch(object:DeskObject,enabled:boolean):Partial<DeskObject>{
 const c=object.cutout;if(!c||c.enabled===enabled)return{};
 const b=bodyRect(object),s=c.source;
 const next=enabled?{x:b.x-s.x*b.width/s.width,y:b.y-s.y*b.height/s.height,width:b.width/s.width,height:b.height/s.height}:sourceRect(object);
 return{x:next.x,y:next.y-cutoutTitle(object),width:next.width,height:next.height+cutoutTitle(object),cutout:{...c,enabled}};
}
export function normalizeCutoutPatch(object:DeskObject,patch:Partial<DeskObject>):Partial<DeskObject>{
 if(patch.cutout===undefined||!object.cutout)return patch;
 const enabled=patch.cutout?.enabled??false;
 if(enabled===object.cutout.enabled)return patch;
 const moved=cutoutTogglePatch(object,enabled);
 // Explicit geometry from an apply operation wins; otherwise ON/OFF derives it.
 return{...moved,...patch};
}
export function moldPath(mold:DeskObject){
 if(!isShapeType(mold.type))throw new Error('型には閉じた図形を選んでください');
 if(mold.type==='ellipse')return'M.5 0 A.5 .5 0 1 1 .5 1 A.5 .5 0 1 1 .5 0 Z';
 if(mold.type==='rect')return'M0 0 H1 V1 H0 Z';
 if(mold.type==='roundedRect'){
  const rx=Math.min(mold.cornerRadius,mold.width/2,mold.height/2)/mold.width,ry=Math.min(mold.cornerRadius,mold.width/2,mold.height/2)/mold.height;
  return`M${rx} 0 H${1-rx} A${rx} ${ry} 0 0 1 1 ${ry} V${1-ry} A${rx} ${ry} 0 0 1 ${1-rx} 1 H${rx} A${rx} ${ry} 0 0 1 0 ${1-ry} V${ry} A${rx} ${ry} 0 0 1 ${rx} 0 Z`;
 }
 return shapePaths(mold.type,1,1)!.outline;
}
export function applyCutoutPatch(target:DeskObject,mold:DeskObject):Partial<DeskObject>{
 if(!cutoutTarget(target))throw new Error('型抜き対象はテキスト・画像・SVG・Mermaid・Web資料です');
 const original=sourceRect(target),window={x:mold.x,y:mold.y,width:mold.width,height:mold.height};
 if(Math.min(original.x+original.width,window.x+window.width)<=Math.max(original.x,window.x)||
    Math.min(original.y+original.height,window.y+window.height)<=Math.max(original.y,window.y))throw new Error('型と対象の中身が重なっていません。変更していません');
 const layout=target.cutout?.layout??{width:original.width,height:original.height};
 return{x:window.x,y:window.y-cutoutTitle(target),width:window.width,height:window.height+cutoutTitle(target),
  cutout:{enabled:true,path:moldPath(mold),layout,source:{x:(original.x-window.x)/window.width,y:(original.y-window.y)/window.height,width:original.width/window.width,height:original.height/window.height}}};
}
/** Frozen layout dimensions prevent reflow just because the viewing window changed. */
export function cutoutSourceObject(object:DeskObject):DeskObject{
 const c=object.cutout!;return{...object,cutout:undefined,width:c.layout.width,height:c.layout.height+cutoutTitle(object),reactions:undefined,stickers:undefined};
}
