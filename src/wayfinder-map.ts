import type {DeskObject} from './model';
import {endpoints} from './geometry';
import {drawConnector,element} from './diagram-drawing';
import {drawConnectorMarker} from './connector-markers';
import {buildJunctionRounding} from './junction-rounding';
import type {RouteBranch,RouteChoice} from './wayfinder-route';
import {WayfinderCancelled,type WayfinderStopReason} from './wayfinder-travel';
import './wayfinder-map.css';

export const wayfinderMapScale=.25;
const width=320,height=240;
/** Clip a straight segment to the fixed local window; used for marker direction hints. */
export function clippedMapLine(x:number,y:number,x2:number,y2:number){
  const dx=x2-x,dy=y2-y;let low=0,high=1;
  for(const [p,q]of [[-dx,x],[dx,width-x],[-dy,y],[dy,height-y]]){
    if(!p){if(q<0)return null;continue;}
    const t=q/p;if(p<0)low=Math.max(low,t);else high=Math.min(high,t);
    if(low>high)return null;
  }
  return {x:x+dx*low,y:y+dy*low,x2:x+dx*high,y2:y+dy*high};
}

export function createWayfinderMap(canvas:SVGSVGElement){
  const panel=document.createElement('div');panel.id='wayfinder-map';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','分岐の進路選択');
  const title=document.createElement('strong');title.textContent='分岐：進路を選んでください';
  const map=document.createElement('div');map.className='wayfinder-map-scene';
  const footer=document.createElement('div');footer.className='wayfinder-map-footer';
  const note=document.createElement('small');note.textContent='矢印は関係の向きです';
  const stop=document.createElement('button');stop.type='button';stop.textContent='停止';stop.id='wayfinder-map-stop';
  footer.append(note,stop);panel.append(title,map,footer);document.body.append(panel);
  let pending:{resolve:(value:RouteChoice)=>void;reject:(reason:Error)=>void;timer:ReturnType<typeof setInterval>}|undefined;
  const close=()=>{if(pending)clearInterval(pending.timer);pending=undefined;panel.hidden=true;canvas.focus({preventScroll:true});};
  const cancel=(reason:WayfinderStopReason='human')=>{if(!pending)return;const reject=pending.reject;close();reject(new WayfinderCancelled(reason));};
  const contains=(node:EventTarget|null)=>node instanceof Node&&panel.contains(node);
  stop.onclick=()=>cancel();
  panel.addEventListener('pointerdown',event=>event.stopPropagation());
  panel.addEventListener('click',event=>event.stopPropagation());
  panel.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();cancel();}});
  // Outside cancellation consumes the complete click, including links behind the map.
  let consume=false;
  document.addEventListener('pointerdown',event=>{
    consume=false;if(!pending||contains(event.target))return;
    consume=true;cancel();event.preventDefault();event.stopImmediatePropagation();
  },true);
  document.addEventListener('pointerup',event=>{if(consume){event.preventDefault();event.stopImmediatePropagation();}},true);
  document.addEventListener('click',event=>{if(consume){consume=false;event.preventDefault();event.stopImmediatePropagation();}},true);
  document.addEventListener('pointercancel',()=>{consume=false;},true);
  return {cancel,contains,isOpen:()=>!!pending,
    choose(scene:DeskObject[],branch:RouteBranch,valid:()=>boolean):Promise<RouteChoice>{
      cancel('superseded');map.replaceChildren();
      const picture=element('svg',{viewBox:`0 0 ${width} ${height}`,'aria-hidden':'true','data-map-scale':wayfinderMapScale});
      const world=element('g',{transform:`translate(${width/2-branch.point.x*wayfinderMapScale} ${height/2-branch.point.y*wayfinderMapScale}) scale(${wayfinderMapScale})`});picture.append(world);map.append(picture);
      const toMap=(p:{x:number;y:number})=>({x:width/2+(p.x-branch.point.x)*wayfinderMapScale,y:height/2+(p.y-branch.point.y)*wayfinderMapScale});
      const rounding=buildJunctionRounding(scene);
      for(const line of scene.filter(o=>o.type==='line')){
        const e=endpoints(line),a=toMap(e.start),b=toMap(e.end),visible=clippedMapLine(a.x,a.y,b.x,b.y);if(!visible)continue;
        const color=line.stroke==='transparent'||!line.strokeWidth?'#94a3b8':line.stroke;
        const group=element('g',{transform:`translate(${line.x} ${line.y})`,'data-map-line':line.id});
        drawConnector(group,{...line,stroke:color,strokeWidth:Math.max(line.strokeWidth,4)},wayfinderMapScale,rounding.get(line.id));
        group.querySelectorAll('.connector-hit,.junction-hit,.connector-marker').forEach(node=>node.remove());world.append(group);
        const angle=Math.atan2(b.y-a.y,b.x-a.x);
        drawConnectorMarker(picture,line.startMarker??'none',visible.x,visible.y,angle+Math.PI,9,color,'start');
        drawConnectorMarker(picture,line.endMarker??'none',visible.x2,visible.y2,angle,9,color,'end');
      }
      picture.append(element('circle',{cx:width/2,cy:height/2,r:4,fill:'#f59e0b'}));
      for(const [index,choice]of branch.choices.entries()){
        const line=scene.find(o=>o.id===choice.lineId)!;const e=endpoints(line),p=e[choice.from],q=e[choice.from==='start'?'end':'start'];
        const dx=q.x-p.x,dy=q.y-p.y,length=Math.hypot(dx,dy)||1,angle=Math.atan2(dy,dx);
        const button=document.createElement('button');button.type='button';button.className='wayfinder-map-choice';button.dataset.lineId=choice.lineId;button.dataset.from=choice.from;
        button.setAttribute('aria-label',`進路 ${index+1}：${line.text||line.id}`);button.title=line.text||line.id;
        button.style.left=`${(width/2+dx/length*80)/width*100}%`;button.style.top=`${(height/2+dy/length*80)/height*100}%`;
        const arrow=document.createElement('span');arrow.textContent='▶';arrow.style.transform=`rotate(${angle}rad)`;button.append(arrow);
        button.onclick=()=>{if(!pending)return;const resolve=pending.resolve;close();resolve(choice);};map.append(button);
      }
      const bounds=canvas.getBoundingClientRect(),x=bounds.left+bounds.width/2,y=bounds.top+bounds.height/2;
      panel.hidden=false;
      const box=panel.getBoundingClientRect(),above=y-box.height-20,top=above>=8?above:y+20;
      panel.style.left=`${Math.max(8,Math.min(x-box.width/2,innerWidth-box.width-8))}px`;
      panel.style.top=`${Math.max(8,Math.min(top,innerHeight-box.height-8))}px`;
      panel.dataset.side=above>=8?'above':'below';panel.style.setProperty('--tip-left',`${x-parseFloat(panel.style.left)}px`);
      return new Promise((resolve,reject)=>{
        const timer=setInterval(()=>{if(!valid())cancel('changed');else if(document.hidden)cancel('hidden');},200);
        pending={resolve,reject,timer};map.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});
      });
    },
  };
}
