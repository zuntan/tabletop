import type {Settings} from './settings';
import {element} from './diagram-drawing';

/** Screen-space strokes mark world zero, below parts and outside the editable scene. */
export function createOriginGuides(canvas:SVGSVGElement,empty:HTMLElement){
 const mask=element('mask',{id:'origin-guide-mask',maskUnits:'userSpaceOnUse',maskContentUnits:'userSpaceOnUse',x:0,y:0,style:'mask-type:luminance'});
 const reveal=element('rect',{x:0,y:0,fill:'white'}),gap=element('rect',{fill:'black'});mask.append(reveal,gap);canvas.querySelector('defs')!.append(mask);
 const layer=element('g',{id:'origin-guides','aria-hidden':'true','pointer-events':'none',mask:'url(#origin-guide-mask)'});
 const path=element('path',{fill:'none','stroke-width':2,'vector-effect':'non-scaling-stroke'});layer.append(path);canvas.querySelector('#viewport')!.before(layer);
 let redraw=()=>{};const observer=new ResizeObserver(()=>redraw());observer.observe(canvas);observer.observe(empty);
 function update(background:Settings['background'],camera:{x:number;y:number}){
  redraw=()=>update(background,camera);
  const enabled=background.originAxes??false;layer.setAttribute('display',enabled?'inline':'none');if(!enabled)return;
  const frame=canvas.getBoundingClientRect(),width=canvas.clientWidth,height=canvas.clientHeight;
  for(const rect of [mask,reveal]){rect.setAttribute('width',String(width));rect.setAttribute('height',String(height));}
  path.setAttribute('stroke',background.originAxesColor??'#94a3b8');path.setAttribute('d',`M 0 ${camera.y} H ${width} M ${camera.x} 0 V ${height}`);
  gap.setAttribute('display',empty.hidden?'none':'inline');
  if(!empty.hidden){
   // Measure the actual text, not the full-width centered HTML container.
   const walker=document.createTreeWalker(empty,NodeFilter.SHOW_TEXT),boxes:DOMRect[]=[];let text:Node|null;
   while((text=walker.nextNode())){const range=document.createRange();range.selectNodeContents(text);boxes.push(...range.getClientRects());}
   const visible=boxes.filter(b=>b.width>0&&b.height>0);
   if(!visible.length){gap.setAttribute('display','none');return;}
   const left=Math.min(...visible.map(b=>b.left))-frame.left-12,top=Math.min(...visible.map(b=>b.top))-frame.top-12;
   const right=Math.max(...visible.map(b=>b.right))-frame.left+12,bottom=Math.max(...visible.map(b=>b.bottom))-frame.top+12;
   for(const [key,value]of Object.entries({x:left,y:top,width:right-left,height:bottom-top}))gap.setAttribute(key,String(value));
  }
 }
 return {update};
}
