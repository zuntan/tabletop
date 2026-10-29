import type {Desk} from './model';
import {bounds} from './geometry';
import {deskSceneRaster} from './desk-pdf';
import './capture-camera.css';
type Rect={x:number;y:number;width:number;height:number};
type Camera={x:number;y:number;zoom:number};
const ns='http://www.w3.org/2000/svg';
/** A transient crop editor. No scene objects, history entries or saved preferences. */
export function createCaptureCamera(desk:Desk,canvas:SVGSVGElement,camera:Camera,changed:()=>void,descriptions:(id:string)=>boolean,report:(s:string,error?:boolean)=>void){
 const modal=document.createElement('div');modal.id='capture-camera';modal.hidden=true;modal.tabIndex=-1;modal.setAttribute('role','dialog');modal.setAttribute('aria-label','カメラの撮影範囲');modal.setAttribute('aria-modal','true');
 const surface=document.createElementNS(ns,'svg');surface.id='capture-surface';surface.setAttribute('aria-label','ドラッグで撮影範囲を指定');
 const frame=document.createElementNS(ns,'rect');frame.id='capture-frame';surface.append(frame);
 const handles=['nw','ne','sw','se'].map(corner=>{const h=document.createElementNS(ns,'rect');h.dataset.corner=corner;h.setAttribute('width','12');h.setAttribute('height','12');surface.append(h);return h;});
 const actions=document.createElement('div');actions.id='capture-actions';
 const hint=document.createElement('span');hint.textContent='範囲を移動・四隅で調整';
 const copy=document.createElement('button');copy.id='capture-copy';copy.textContent='コピー';
 const cancel=document.createElement('button');cancel.textContent='キャンセル';cancel.id='capture-cancel';actions.append(hint,copy,cancel);modal.append(surface,actions);document.body.append(modal);
 let rect:Rect|undefined,last:Rect|undefined,generation=desk.documentGeneration,working=false,previous:HTMLElement|null=null;
 let drag:undefined|{id:number;mode:string;start:{x:number;y:number};rect?:Rect};
 const active=()=>!modal.hidden;
 function screen(r:Rect){return{x:r.x*camera.zoom+camera.x,y:r.y*camera.zoom+camera.y,width:r.width*camera.zoom,height:r.height*camera.zoom};}
 function point(e:PointerEvent){const b=canvas.getBoundingClientRect();return{x:(e.clientX-b.left-camera.x)/camera.zoom,y:(e.clientY-b.top-camera.y)/camera.zoom};}
 function draw(){
  const b=canvas.getBoundingClientRect();Object.assign(surface.style,{left:`${b.left}px`,top:`${b.top}px`,width:`${b.width}px`,height:`${b.height}px`});
  const r=rect?screen(rect):undefined;frame.style.display=r?'':'none';handles.forEach(h=>h.style.display=r?'':'none');copy.disabled=!rect||working;
  if(r){for(const [k,v]of Object.entries(r))frame.setAttribute(k,String(v));for(const h of handles){h.setAttribute('x',String(r.x+(h.dataset.corner!.endsWith('e')?r.width:0)-6));h.setAttribute('y',String(r.y+(h.dataset.corner!.startsWith('s')?r.height:0)-6));}}
  const aw=actions.offsetWidth,ah=actions.offsetHeight;
  actions.style.left=`${Math.max(8,Math.min(innerWidth-aw-8,b.left+(r?r.x+r.width:b.width)-aw))}px`;
  actions.style.top=`${Math.max(8,Math.min(innerHeight-ah-8,b.top+(r?r.y+r.height:b.height)+12))}px`;
 }
 function close(){if(working)return;modal.hidden=true;drag=undefined;previous?.focus();}
 cancel.onclick=close;
 async function capture(){
  if(!rect||working)return;
  if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined'){report('このブラウザでは画像のクリップボード転送を利用できません',true);return;}
  working=true;draw();cancel.disabled=true;const crop={...rect};
  try{
   let webCount=0;
   const png=deskSceneRaster(desk,canvas,descriptions,crop).then(async result=>{webCount=result.webCount;return new Promise<Blob>((resolve,reject)=>result.bitmap.toBlob(blob=>blob?resolve(blob):reject(new Error('PNGを作成できません')),'image/png'));});
   // Start the clipboard operation in the click/key activation, before asynchronous rendering.
   await navigator.clipboard.write([new ClipboardItem({'image/png':png})]);
   last=crop;working=false;close();report(`撮影した画像をコピーしました${webCount?'（Web資料の本文は代替表示）':''}`);
  }catch(error){report(`画像コピーに失敗しました：${error instanceof Error?error.message:String(error)}`,true);}
  finally{working=false;cancel.disabled=false;draw();}
 }
 copy.onclick=()=>void capture();
 surface.onpointerdown=e=>{
  if(working||e.button!==0)return;e.preventDefault();surface.setPointerCapture(e.pointerId);
  const target=e.target as SVGElement,mode=target.dataset.corner??(target===frame?'move':'new');drag={id:e.pointerId,mode,start:point(e),rect:rect?{...rect}:undefined};
  if(mode==='new'){rect=undefined;draw();}
 };
 surface.onpointermove=e=>{
  if(!drag||drag.id!==e.pointerId)return;const p=point(e),d=drag,old=d.rect;
  if(d.mode==='move'&&old)rect={...old,x:old.x+p.x-d.start.x,y:old.y+p.y-d.start.y};
  else {const a=d.mode==='new'?d.start:{x:old!.x+(d.mode.endsWith('w')?old!.width:0),y:old!.y+(d.mode.startsWith('n')?old!.height:0)};rect={x:Math.min(a.x,p.x),y:Math.min(a.y,p.y),width:Math.max(1,Math.abs(p.x-a.x)),height:Math.max(1,Math.abs(p.y-a.y))};}draw();
 };
 const end=(e:PointerEvent)=>{if(drag?.id===e.pointerId){drag=undefined;if(surface.hasPointerCapture(e.pointerId))surface.releasePointerCapture(e.pointerId);}};
 surface.onpointerup=end;surface.onpointercancel=end;
 modal.addEventListener('wheel',e=>e.preventDefault(),{passive:false});
 document.addEventListener('keydown',e=>{if(!active())return;e.stopImmediatePropagation();if(e.key==='Escape'){e.preventDefault();close();}else if(e.key==='Enter'){e.preventDefault();void capture();}else if(e.key==='Tab'){e.preventDefault();(document.activeElement===copy?cancel:copy).focus();}},true);
 window.addEventListener('resize',()=>{if(active())draw();});
 return{isActive:active,open(){
  if(active())return;if(generation!==desk.documentGeneration){last=undefined;generation=desk.documentGeneration;}
  const selected=desk.selected().map(id=>bounds(desk.get(id)));
  if(selected.length){const x=Math.min(...selected.map(b=>b.x)),y=Math.min(...selected.map(b=>b.y));rect={x,y,width:Math.max(1,...selected.map(b=>b.x+b.width-x)),height:Math.max(1,...selected.map(b=>b.y+b.height-y))};}else rect=last?{...last}:undefined;
  if(rect){const b=screen(rect),w=canvas.clientWidth,h=canvas.clientHeight;if(b.x<24||b.y<24||b.x+b.width>w-24||b.y+b.height>h-72){camera.zoom=Math.max(.001,Math.min(camera.zoom,(w-64)/rect.width,(h-112)/rect.height));camera.x=w/2-(rect.x+rect.width/2)*camera.zoom;camera.y=(h-56)/2-(rect.y+rect.height/2)*camera.zoom;changed();}}
  previous=document.activeElement instanceof HTMLElement?document.activeElement:null;modal.hidden=false;draw();modal.focus();
 }};
}
