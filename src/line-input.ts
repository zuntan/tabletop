import type {Desk,DeskObject} from './model';
import {endpoints,type Point} from './geometry';
import {element as svg} from './diagram-drawing';
import {snapLinePoint,simplifyStroke,continuousLineOperations,type LinePoint} from './continuous-lines';

type Mode='continuous'|'free';
export function createLineInput(canvas:SVGSVGElement,viewport:SVGGElement,button:HTMLButtonElement,desk:Desk,
 world:(event:PointerEvent)=>Point,zoom:()=>number,appearance:()=>Partial<DeskObject>,refresh:()=>void,canStart:()=>boolean,report:(text:string,error?:boolean)=>void,snapScene:()=>DeskObject[]=()=>desk.snapshot()){
 const wrap=document.createElement('span');wrap.className='line-input-tools';button.before(wrap);wrap.append(button);
 const trigger=document.createElement('button');trigger.type='button';trigger.id='line-input-open';trigger.textContent='▾';trigger.title='線の入力方法';trigger.setAttribute('aria-label',trigger.title);trigger.setAttribute('aria-haspopup','menu');trigger.setAttribute('aria-expanded','false');wrap.append(trigger);
 const menu=document.createElement('div');menu.id='line-input-menu';menu.popover='auto';menu.setAttribute('role','menu');menu.setAttribute('aria-label','線の入力方法');document.body.append(menu);trigger.popoverTargetElement=menu;
 const layer=svg('g',{'pointer-events':'none','aria-hidden':'true','data-line-input-preview':''});viewport.append(layer);
 let mode:Mode|null=null,tail:LinePoint|undefined,origin:LinePoint|undefined,created:string[]=[],revision=0,generation='',pointer:number|undefined,stroke:Point[]=[],strokeZoom=1,space=false;
 const existing=()=>created.filter(id=>desk.snapshot().some(o=>o.id===id));
 function finish(message=true){const ids=existing();mode=null;tail=origin=undefined;stroke=[];const captured=pointer;pointer=undefined;if(captured!==undefined&&canvas.hasPointerCapture(captured))canvas.releasePointerCapture(captured);layer.replaceChildren();delete canvas.dataset.lineInput;trigger.removeAttribute('data-active');document.querySelector('#selection-mode')?.setAttribute('aria-pressed','true');if(ids.length)desk.select(ids);created=[];refresh();if(message)report(ids.length?`${ids.length}本の線を作成しました`:'線の入力を終了しました');}
 const valid=()=>{if(desk.documentGeneration===generation&&desk.revision===revision)return true;finish(false);report('机が変更されたため線の入力を終了しました',true);return false;};
 function start(value:Mode){if(!canStart())return;finish(false);mode=value;revision=desk.revision;generation=desk.documentGeneration;canvas.dataset.lineInput=value;trigger.dataset.active='true';document.querySelector('#selection-mode')?.setAttribute('aria-pressed','false');canvas.focus({preventScroll:true});report(value==='continuous'?'連続線：始点をクリック。Enter／Escで終了、Altで吸着解除':'フリー連続線：ドラッグして描き、離すと清書します');}
 for(const [value,label]of [['continuous','連続線'],['free','フリー連続線']] as const){const item=document.createElement('button');item.type='button';item.textContent=label;item.setAttribute('role','menuitem');item.onclick=()=>{menu.hidePopover();start(value);};menu.append(item);}
 menu.addEventListener('toggle',()=>{const open=menu.matches(':popover-open');trigger.setAttribute('aria-expanded',String(open));if(open){const rect=trigger.getBoundingClientRect();menu.style.left=`${Math.max(8,Math.min(button.getBoundingClientRect().left,innerWidth-menu.offsetWidth-8))}px`;menu.style.top=`${rect.bottom+6}px`;}});
 menu.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape'){menu.hidePopover();trigger.focus();}if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();const items=[...menu.querySelectorAll('button')],index=items.indexOf(document.activeElement as HTMLButtonElement);items[(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length].focus();}});
 trigger.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();event.stopPropagation();menu.showPopover();menu.querySelector('button')?.focus();}});
 function preview(points:Point[]){layer.replaceChildren();if(!points.length)return;const style=appearance(),stroke=style.stroke??'#334155';if(points.length>1)layer.append(svg('polyline',{points:points.map(p=>`${p.x},${p.y}`).join(' '),fill:'none',stroke,'stroke-width':style.strokeWidth??2,'stroke-linecap':'round','stroke-linejoin':'round',opacity:.65}));for(const p of [points[0],points.at(-1)!])layer.append(svg('circle',{cx:p.x,cy:p.y,r:4/zoom(),fill:'#fff',stroke,'stroke-width':1.5/zoom()}));}
 function commit(points:Point[],start:LinePoint,end:LinePoint){const result=continuousLineOperations(desk.snapshot(),points,appearance(),start,end);if(!result.ids.length)return false;desk.execute({actor:'human',snap:'exact',expectedRevision:revision,operations:result.operations});revision=desk.revision;created.push(...result.ids);refresh();return true;}
 function point(event:PointerEvent){return snapLinePoint(world(event),snapScene(),zoom(),desk.settingsSnapshot().grid,event.altKey);}
 function closed(p:LinePoint,event:PointerEvent){return !event.altKey&&origin&&existing().length>=2&&Math.hypot(p.point.x-origin.point.x,p.point.y-origin.point.y)<=12/zoom();}
 const stop=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();};
 canvas.addEventListener('pointerdown',event=>{
  if(mode&&pointer!==undefined){stop(event);return;}
  if(!mode||space||event.button!==0)return;if(!valid())return;stop(event);
  try{
   if(mode==='continuous'){
    let end=point(event);
    if(!tail){tail=origin=end;preview([end.point]);report('連続線：次の頂点をクリック。Enter／Escで終了');return;}
    const closes=closed(end,event);if(closes){const first=existing()[0];end={point:origin!.point,endpoint:{id:first,side:'start'}};}
    if(Math.hypot(end.point.x-tail.point.x,end.point.y-tail.point.y)<1e-6)return;
    if(commit([tail.point,end.point],tail,end)){const id=existing().at(-1)!;tail={point:end.point,endpoint:{id,side:'end'}};preview([end.point]);if(closes)finish();}
   }else{pointer=event.pointerId;strokeZoom=zoom();tail=origin=point(event);stroke=[tail.point];canvas.setPointerCapture(pointer);preview(stroke);}
  }catch(error){finish(false);report(error instanceof Error?error.message:String(error),true);}
 },true);
 canvas.addEventListener('pointermove',event=>{
  if(!mode||space)return;if(!valid())return;
  if(mode==='continuous'){if(tail)preview([tail.point,point(event).point]);return;}
  if(pointer!==event.pointerId)return;stop(event);
  const p=world(event),last=stroke.at(-1)!;if(Math.hypot(p.x-last.x,p.y-last.y)*strokeZoom<2)return;
  stroke.push(p);if(stroke.length>4096)stroke=stroke.filter((_,i)=>i%2===0||i===stroke.length-1);preview(stroke);
 },true);
 canvas.addEventListener('pointerup',event=>{
  if(!mode||mode!=='free'||pointer!==event.pointerId)return;stop(event);if(!valid())return;
  try{
   let end=point(event);const raw=world(event);stroke.push(raw);
   if(!event.altKey&&origin&&stroke.length>3&&Math.hypot(raw.x-origin.point.x,raw.y-origin.point.y)*strokeZoom<=12)end=origin;
   const points=simplifyStroke(stroke,strokeZoom);if(points.length>1){points[0]=tail!.point;points[points.length-1]=end.point;commit(points,tail!,end);}finish();
  }catch(error){finish(false);report(error instanceof Error?error.message:String(error),true);}
 },true);
 canvas.addEventListener('pointercancel',event=>{if(mode&&pointer===event.pointerId){stop(event);finish();}},true);
 canvas.addEventListener('lostpointercapture',event=>{if(mode&&pointer===event.pointerId)finish();},true);
 canvas.addEventListener('dblclick',event=>{if(mode)stop(event);},true);
 canvas.addEventListener('wheel',event=>{if(pointer!==undefined)stop(event);},{capture:true,passive:false});
 document.addEventListener('pointerdown',event=>{if(mode&&!canvas.contains(event.target as Node))finish();},true);
 window.addEventListener('keydown',event=>{
  if(!mode)return;if(event.code==='Space'){space=true;return;}
  if((event.target as Element)?.closest('input,textarea,select'))return;
  if(event.key==='Enter'||event.key==='Escape'){stop(event);finish();return;}
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){
   stop(event);if(pointer!==undefined){finish();return;}
   try{if(event.shiftKey)desk.redo();else if(existing().length)desk.undo();else {tail=origin=undefined;layer.replaceChildren();return;}revision=desk.revision;
    const ids=existing();tail=ids.length?{point:endpoints(desk.get(ids.at(-1)!)).end,endpoint:{id:ids.at(-1)!,side:'end'}}:origin;
    refresh();if(tail)preview([tail.point]);else layer.replaceChildren();
   }catch(error){report(error instanceof Error?error.message:String(error),true);}return;
  }
  if(event.key==='Delete'||event.key==='Backspace'){stop(event);return;}
 },true);
 window.addEventListener('keyup',event=>{if(event.code==='Space')space=false;});
 window.addEventListener('blur',()=>{space=false;if(mode)finish();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode)finish();});
 return{isActive:()=>mode!==null,isDrawing:()=>pointer!==undefined,finish:()=>{if(mode)finish();}};
}
