import type { DeskObject } from './model';
import { endpoints, isConnector, type Point } from './geometry';
import { bindingField, junctionField, type EndpointSide } from './connector-junctions';
import { buildJunctionRounding } from './junction-rounding';

const opposite = (side: EndpointSide): EndpointSide => side === 'start' ? 'end' : 'start';
const center = (o: DeskObject): Point => ({ x: o.x + o.width / 2, y: o.y + o.height / 2 });
export type RouteChoice={lineId:string;from:EndpointSide};
export type RouteBranch={point:Point;choices:RouteChoice[];incoming?:RouteChoice};
export type WayfinderRoute = { points: Point[]; lineIds: string[]; destinationId?: string; branch?:RouteBranch; loop?:boolean };
const choice=(p:{object:DeskObject;side:EndpointSide}):RouteChoice=>({lineId:p.object.id,from:p.side});
function peersAt(scene:DeskObject[],junction:string){
  return scene.filter(isConnector).flatMap(object=>(['start','end'] as const).filter(side=>object[junctionField(side)]===junction).map(side=>({object,side})));
}

/** Explicit line and departure end are also the entry used after a branch choice. */
export function lineRoute(scene:DeskObject[],lineId:string,from:EndpointSide):WayfinderRoute{
  const first=scene.find(o=>o.id===lineId&&isConnector(o));
  if(!first)throw new Error('出発する線がありません');
  const visited=new Set<string>(),steps:{object:DeskObject;side:EndpointSide}[]=[];
  let current={object:first,side:from},destination:DeskObject|undefined,branch:RouteBranch|undefined,loop=false;
  while(current){
    if(visited.has(current.object.id)){loop=true;break;}
    visited.add(current.object.id);steps.push(current);
    const exit=opposite(current.side),binding=current.object[bindingField(exit)];
    if(binding){
      const target=scene.find(o=>o.id===binding.objectId);
      if(!target)throw new Error('経路の接続先がありません');
      destination=target.type==='wayfinder'&&target.attachment?scene.find(o=>o.id===target.attachment!.objectId):target;
      break;
    }
    const junction=current.object[junctionField(exit)];if(!junction)break;
    const next=peersAt(scene,junction).filter(p=>p.object.id!==current.object.id);
    if(next.length>1){branch={point:endpoints(current.object)[exit],choices:next.map(choice),incoming:choice({object:current.object,side:exit})};break;}
    if(!next.length)break;
    current=next[0];
  }
  const rounding=buildJunctionRounding(scene),points:Point[]=[endpoints(first)[from]];
  const push=(p:Point)=>{const last=points.at(-1)!;if(Math.hypot(p.x-last.x,p.y-last.y)>1e-8)points.push(p);};
  const trimmed=(object:DeskObject,side:EndpointSide):Point=>{
    const e=endpoints(object),p=e[side],q=e[opposite(side)],d=rounding.get(object.id)?.[side]??0,length=Math.hypot(q.x-p.x,q.y-p.y);
    return !length?p:{x:p.x+(q.x-p.x)*d/length,y:p.y+(q.y-p.y)*d/length};
  };
  steps.forEach(({object,side},index)=>{
    push(trimmed(object,side));
    const exit=opposite(side),end=trimmed(object,exit);push(end);
    const next=steps[index+1];
    if(next&&(rounding.get(object.id)?.[exit]??0)>0){
      const to=trimmed(next.object,next.side),control=endpoints(object)[exit];
      for(let n=1;n<=24;n++){const t=n/24,s=1-t;push({x:s*s*end.x+2*s*t*control.x+t*t*to.x,y:s*s*end.y+2*s*t*control.y+t*t*to.y});}
    }
  });
  if(destination)push(center(destination));
  if(branch)push(branch.point);
  return {points,lineIds:[...visited],destinationId:destination?.id,branch,loop};
}

/** Object attachment is separate from the road; arrows never choose travel direction. */
export function wayfinderRoute(scene:DeskObject[],id:string):WayfinderRoute{
  const source=scene.find(o=>o.id===id&&o.type==='wayfinder');if(!source)throw new Error('道しるべがありません');
  const ports=scene.filter(isConnector).flatMap(object=>(['start','end'] as const).filter(side=>object[bindingField(side)]?.objectId===id).map(side=>({object,side})));
  if(ports.length!==1)throw new Error('道しるべには上・左・右のどれかへ経路の線を1本つないでください');
  const start=ports[0],junction=start.object[junctionField(start.side)],peers=junction?peersAt(scene,junction):[];
  if(peers.length>1){const point=endpoints(start.object)[start.side];return {points:[center(source),point],lineIds:[],branch:{point,choices:peers.map(choice)}};}
  const route=lineRoute(scene,start.object.id,start.side);
  return {...route,points:[center(source),...route.points]};
}

/** Arc length makes speed independent of how many line segments describe a road. */
export function measuredRoute(points: Point[]) {
  const lengths=[0];
  for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y));
  const length=lengths.at(-1)??0;
  return {length,at(progress:number):Point{
    if(!points.length)throw new Error('Empty route');
    if(progress<=0||!length)return {...points[0]};if(progress>=1)return {...points.at(-1)!};
    const d=length*progress;let low=1,high=lengths.length-1;
    while(low<high){const mid=(low+high)>>1;if(lengths[mid]<d)low=mid+1;else high=mid;}
    const i=low,t=(d-lengths[i-1])/(lengths[i]-lengths[i-1]);
    return {x:points[i-1].x+(points[i].x-points[i-1].x)*t,y:points[i-1].y+(points[i].y-points[i-1].y)*t};
  }};
}
