import type { Desk } from './model';
import { cloneSvgForRaster } from './part-raster';
import { jpegPagePdf, pdfRasterSize } from './pdf-document';
import { drawStamp } from './stamps';
import { cutoutSourceObject } from './logical-cutout';
import { drawReactions } from './reactions';
import { drawStickers } from './stickers';
import { pinTransform } from './pin-series';
import { drawConnector } from './diagram-drawing';
import { buildJunctionRounding } from './junction-rounding';
import { calloutPath, drawCalloutLeader } from './text-callouts';

type Rect={x:number;y:number;width:number;height:number};
function transformedBox(node:SVGGElement,box:Rect){
 const matrix=node.transform.baseVal.consolidate()?.matrix??new DOMMatrix();
 const points=[[box.x,box.y],[box.x+box.width,box.y],[box.x,box.y+box.height],[box.x+box.width,box.y+box.height]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(matrix));
 const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));
 return{x,y,width:Math.max(...points.map(p=>p.x))-x,height:Math.max(...points.map(p=>p.y))-y};
}
function union(boxes:Rect[]):Rect{
 if(!boxes.length)return{x:0,y:0,width:1024,height:768};
 const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));
 return{x,y,width:Math.max(...boxes.map(b=>b.x+b.width))-x,height:Math.max(...boxes.map(b=>b.y+b.height))-y};
}

/** Snapshot the entire rendered scene at canonical 100% scale, not the current camera. */
export async function deskPdf(desk:Desk,canvas:SVGSVGElement,descriptions:(id:string)=>boolean){
 const revision=desk.revision,objects=desk.snapshot(),name=desk.settingsSnapshot().name;
 if(document.fonts.status!=='loaded'){
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{await Promise.race([document.fonts.ready,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('フォントを読み込み中です。少し待って再実行してください')),5000);})]);}finally{clearTimeout(timer);}
 }
 const webCount=canvas.querySelectorAll('#objects iframe').length;
 const root=await cloneSvgForRaster(canvas);
 if(desk.revision!==revision)throw new Error('生成中に机が変更されました。もう一度実行してください');
 root.removeAttribute('id');root.removeAttribute('style');root.setAttribute('width','1024');root.setAttribute('height','768');
 root.setAttribute('font-family',getComputedStyle(canvas).fontFamily);
 root.setAttribute('color',getComputedStyle(canvas).color);
 root.querySelector('#origin-guides')?.remove();root.querySelector('#origin-guide-mask')?.remove();
 root.querySelector('[data-line-input-preview]')?.remove();
 root.querySelector('#overlays')?.remove();root.querySelectorAll('.open-link,.connector-hit').forEach(n=>n.remove());
 root.querySelector('#viewport')?.removeAttribute('transform');
 for(const pattern of root.querySelectorAll('pattern'))pattern.removeAttribute('patternTransform');
 const rounding=buildJunctionRounding(objects);
 for(const object of objects){
  const group=[...root.querySelectorAll<SVGGElement>('#objects > [data-id]')].find(n=>n.dataset.id===object.id);
  if(!group)continue;
  if(object.type==='label')group.setAttribute('transform',pinTransform(object,1));
  if(object.type==='line'){
    group.setAttribute('transform',`translate(${object.x} ${object.y})`);group.replaceChildren();drawConnector(group,object,1,rounding.get(object.id));
  }
  if(object.type==='text'){
    const source=object.cutout?group.querySelector<SVGGElement>('[data-cutout-source]'):group;
    if(source)drawStamp(source,object.cutout?cutoutSourceObject(object):object,false);
    if(!object.cutout&&object.callout){group.querySelector('.text-callout')?.setAttribute('d',calloutPath(object));drawCalloutLeader(group,object);}
  }
  drawReactions(group,object,descriptions(object.id),1);
  drawStickers(group,object,1);
 }
 root.querySelectorAll('.open-link,.connector-hit').forEach(n=>n.remove());
 root.querySelectorAll('[vector-effect]').forEach(n=>n.removeAttribute('vector-effect'));
 const host=document.createElement('div');host.style.cssText='position:fixed;left:-100000px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
 host.append(root);document.body.append(host);
 let box:Rect;
 try{
  const boxes:Rect[]=[];
  for(const object of objects){
   const group=[...root.querySelectorAll<SVGGElement>('#objects > [data-id]')].find(n=>n.dataset.id===object.id);if(!group)continue;
   let b:Rect=group.getBBox();
   if(object.cutout){
    const parts:Rect[]=[{x:0,y:0,width:object.width,height:object.height}];
    for(const badges of group.querySelectorAll<SVGGElement>(':scope > [data-reactions], :scope > [data-stickers]'))parts.push(transformedBox(badges,badges.getBBox()));
    b=union(parts);
   }
   const world=transformedBox(group,b),pad=Math.max(2,object.strokeWidth/2);
   boxes.push({x:world.x-pad,y:world.y-pad,width:world.width+pad*2,height:world.height+pad*2});
  }
  const bounds=union(boxes);box={x:bounds.x-24,y:bounds.y-24,width:bounds.width+48,height:bounds.height+48};
 }finally{host.remove();}
 for(const id of ['desk-underlay','desk-background','desk-wallpaper','desk-grid']){
  const rect=root.querySelector(`#${id}`);if(!rect)continue;
  for(const [key,value]of Object.entries(box))rect.setAttribute(key,String(value));
 }
 const raster=pdfRasterSize(box.width,box.height);
 root.setAttribute('viewBox',`${box.x} ${box.y} ${box.width} ${box.height}`);root.setAttribute('width',String(raster.width));root.setAttribute('height',String(raster.height));root.setAttribute('preserveAspectRatio','none');
 const image=new Image();image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(root));
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{await Promise.race([image.decode(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('机の画像化が時間内に完了しませんでした')),15000);})]);}finally{clearTimeout(timer);}
 const bitmap=document.createElement('canvas');bitmap.width=raster.width;bitmap.height=raster.height;
 const ctx=bitmap.getContext('2d');if(!ctx)throw new Error('PDF画像を作成できません');
 ctx.fillStyle='#fff';ctx.fillRect(0,0,bitmap.width,bitmap.height);ctx.drawImage(image,0,0,bitmap.width,bitmap.height);
 const data=bitmap.toDataURL('image/jpeg',.95);if(!data.startsWith('data:image/jpeg;'))throw new Error('画像サイズがブラウザの上限を超えています');
 const jpeg=Uint8Array.from(atob(data.split(',')[1]),c=>c.charCodeAt(0));
 const bytes=jpegPagePdf(jpeg,raster.width,raster.height,name||'Tabletop',{width:box.width,height:box.height});
 return{bytes,revision,bounds:box,raster,webCount};
}
