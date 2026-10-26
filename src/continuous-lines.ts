import type {DeskObject,Operation} from './model';
import {snap,type Point,type Binding} from './geometry';
import {snapConnectorEndpoint,junctionField} from './connector-junctions';
import {gridPoint} from './grid';
import type {GridSettings} from './grid-settings';
import {fileFor} from './clear-files';
import {randomUuid} from './portable-crypto';

export type LinePoint={point:Point;binding?:Binding|null;endpoint?:{id:string;side:'start'|'end'}};
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
export function snapLinePoint(point:Point,scene:DeskObject[],zoom:number,grid:GridSettings,alt=false):LinePoint{
 if(alt)return{point};
 const shape=snap(point,scene,18/zoom);
 const candidate=snapConnectorEndpoint(point,scene.filter(o=>!o.locked&&!fileFor(scene,o.id)),18/zoom,'');
 if(candidate&&(!shape||distance(point,candidate.point)<distance(point,shape.point)))return{point:candidate.point,endpoint:{id:candidate.object.id,side:candidate.side}};
 if(shape)return{point:shape.point,binding:shape.binding};
 return{point:grid.enabled?gridPoint(point,grid):point};
}
function segmentDistance(p:Point,a:Point,b:Point){const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;if(!length)return distance(p,a);const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length));return distance(p,{x:a.x+t*dx,y:a.y+t*dy});}
export function simplifyStroke(points:Point[],zoom:number):Point[]{
 if(points.length<2)return[];
 const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
 const diagonal=Math.hypot(maxX-minX,maxY-minY)*zoom;
 if(diagonal<6)return[];
 let tolerance=Math.max(6,Math.min(18,diagonal*.025))/zoom;
 let result:Point[]=[];
 for(let pass=0;pass<32;pass++){
  const keep=new Set([0,points.length-1]),stack:[[number,number]]|[number,number][]=[[0,points.length-1]];
  while(stack.length){const [a,b]=stack.pop()!;let best=-1,max=tolerance;for(let i=a+1;i<b;i++){const d=segmentDistance(points[i],points[a],points[b]);if(d>max){max=d;best=i;}}if(best>=0){keep.add(best);stack.push([a,best],[best,b]);}}
  result=[...keep].sort((a,b)=>a-b).map(i=>points[i]).filter((p,i,list)=>!i||distance(p,list[i-1])>1e-6);
  if(result.length<=25)break;tolerance*=1.5;
 }
 return result;
}
/** Ordinary line objects and point-group IDs, one atomic batch per free stroke. */
export function continuousLineOperations(scene:DeskObject[],points:Point[],style:Partial<DeskObject>,start:LinePoint,end:LinePoint){
 const clean=points.filter((p,i)=>!i||distance(p,points[i-1])>1e-6);
 if(clean.length<2)return{operations:[] as Operation[],ids:[] as string[]};
 const ids=Array.from({length:clean.length-1},()=> 'line-'+randomUuid());
 const objects=ids.map((id,i)=>({ ...style,id,type:'line' as const,x:clean[i].x,y:clean[i].y,x2:clean[i+1].x,y2:clean[i+1].y,startMarker:'none' as const,endMarker:'none' as const,junctionRounding:48,startBinding:null as Binding|null,endBinding:null as Binding|null,startJunction:null as string|null,endJunction:null as string|null }));
 for(let i=1;i<objects.length;i++){const id='junction-'+randomUuid();objects[i-1].endJunction=id;objects[i].startJunction=id;}
 const patches=new Map<string,Partial<DeskObject>>();
 const attach=(target:LinePoint,object:typeof objects[number],side:'start'|'end')=>{
  const binding=side==='start'?'startBinding':'endBinding';object[binding]=target.binding??null;
  if(!target.endpoint)return;
  const old=scene.find(o=>o.id===target.endpoint!.id);if(!old||old.type!=='line')throw Error('接続先の線が変わりました');
  const field=junctionField(target.endpoint.side),id=patches.get(old.id)?.[field]??old[field]??'junction-'+randomUuid();
  object[junctionField(side)]=id;patches.set(old.id,{...patches.get(old.id),[field]:id});
 };
 attach(start,objects[0],'start');attach(end,objects.at(-1)!,'end');
 if(distance(clean[0],clean.at(-1)!)<1e-6&&objects.length>1){const id=objects[0].startJunction??objects.at(-1)!.endJunction??'junction-'+randomUuid();objects[0].startJunction=id;objects.at(-1)!.endJunction=id;}
 return{operations:[...[...patches].map(([id,patch])=>({kind:'update' as const,id,patch})),...objects.map(object=>({kind:'add' as const,object}))] as Operation[],ids};
}
