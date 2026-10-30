import {cameraView,type Camera} from './camera-control';
import {bounds,isConnector} from './geometry';
import type {DeskObject} from './model';
import {overviewUnion,overviewLayout,offscreenDirections,type OverviewRect} from './desk-overview-values';
import './desk-overview.css';

/** Cached object rectangles, two SVG rectangles, and a constant-time low-zoom direction check. */
export function createDeskOverview(workspace:HTMLElement,canvas:SVGSVGElement,message:HTMLElement,camera:Camera){
  const status=document.createElement('span');status.id='offscreen-indicator';status.hidden=true;
  const statusText=document.createElement('span');statusText.id='desk-status-text';message.before(statusText);statusText.append(message,status);
  const control=document.createElement('div');control.id='desk-overview';
  const toggle=document.createElement('button');toggle.type='button';toggle.id='overview-toggle';toggle.title='簡易マップを開閉';toggle.setAttribute('aria-label',toggle.title);
  const ns='http://www.w3.org/2000/svg';
  const icon=document.createElementNS(ns,'svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('width','16');icon.setAttribute('height','16');icon.setAttribute('fill','none');icon.setAttribute('stroke','currentColor');icon.setAttribute('stroke-width','1.5');icon.setAttribute('aria-hidden','true');
  for(const [x,y,w,h] of [[3,4,18,16],[7,8,9,7]]){const rect=document.createElementNS(ns,'rect');for(const [key,value] of Object.entries({x,y,width:w,height:h,rx:1}))rect.setAttribute(key,String(value));icon.append(rect);}toggle.append(icon);
  const panel=document.createElement('div');panel.id='overview-panel';toggle.setAttribute('aria-controls',panel.id);
  const map=document.createElementNS(ns,'svg');map.id='overview-map';map.setAttribute('viewBox','0 0 164 112');map.setAttribute('role','img');map.setAttribute('aria-label','机上全体と現在の表示範囲');
  const allRect=document.createElementNS(ns,'rect');allRect.dataset.overviewAll='';
  const viewRect=document.createElementNS(ns,'rect');viewRect.dataset.overviewView='';map.append(allRect,viewRect);
  const legend=document.createElement('div');legend.className='overview-legend';legend.innerHTML='<span class="overview-all-key">机上全体</span><span class="overview-view-key">表示範囲</span>';
  panel.append(map,legend);control.append(toggle,panel);workspace.append(control);
  let open=false;try{open=localStorage.getItem('tabletop.overview.open')==='true';}catch{/* In-memory fallback. */}
  let all:OverviewRect|null=null,frame=0;
  function update(){
    frame=0;if(canvas.clientWidth<=0||canvas.clientHeight<=0)return;
    const view=cameraView(camera,{width:canvas.clientWidth,height:canvas.clientHeight}).visibleBounds;
    const directions=camera.zoom<.1?offscreenDirections(all,view):'';
    const label=directions?`画面外：${directions}`:'';
    if(status.textContent!==label)status.textContent=label;status.hidden=!directions;
    status.title='10%未満：机上全体の矩形が表示範囲からはみ出す方向';
    panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));
    if(!open)return;
    const layout=overviewLayout(all,view);
    for(const [node,rect] of [[allRect,layout.all],[viewRect,layout.view]] as const){
      node.style.display=rect?'':'none';if(rect)for(const [key,value] of Object.entries(rect))node.setAttribute(key,String(value));
    }
  }
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
  toggle.onclick=()=>{open=!open;try{localStorage.setItem('tabletop.overview.open',String(open));}catch{/* In-memory fallback. */}schedule();};
  toggle.onkeydown=event=>{if(event.key===' '||event.key==='Enter')event.stopPropagation();};
  control.addEventListener('pointerdown',event=>event.stopPropagation());control.addEventListener('wheel',event=>event.stopPropagation());
  new ResizeObserver(schedule).observe(canvas);
  return {cameraChanged:schedule,setObjects(objects:readonly DeskObject[]){
    const boxes=objects.map(object=>isConnector(object)?bounds(object):{x:object.x,y:object.y,width:object.width,height:object.height});
    all=overviewUnion(boxes);schedule();
  }};
}
