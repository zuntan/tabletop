import type { DeskObject } from './model';
import { endpoints, isConnector, type Point } from './geometry';
import { bindingField, junctionField, type EndpointSide } from './connector-junctions';
import { buildJunctionRounding } from './junction-rounding';

const opposite = (side: EndpointSide): EndpointSide => side === 'start' ? 'end' : 'start';
const center = (o: DeskObject): Point => ({ x: o.x + o.width / 2, y: o.y + o.height / 2 });
export type WayfinderRoute = { points: Point[]; lineIds: string[]; destinationId?: string };

/** Follow explicit bindings/junction IDs, never visual proximity or arrow directions. */
export function wayfinderRoute(scene: DeskObject[], id: string): WayfinderRoute {
  const source = scene.find(o => o.id === id && o.type === 'wayfinder');
  if (!source) throw new Error('道しるべがありません');
  const edges = scene.filter(isConnector);
  const ports = (target: string) => edges.flatMap(object => (['start','end'] as const)
    .filter(side => object[bindingField(side)]?.objectId === target).map(side => ({ object, side })));
  const starts = ports(id);
  if (starts.length !== 1) throw new Error('道しるべには上・左・右のどれかへ経路の線を1本つないでください');
  const departureJunction=starts[0].object[junctionField(starts[0].side)];
  if(departureJunction&&edges.some(line=>line.id!==starts[0].object.id&&[line.startJunction,line.endJunction].includes(departureJunction)))
    throw new Error('出発点に分岐があります。初版では進路を選べないため発進しません');
  const visited = new Set<string>(), steps: { object: DeskObject; side: EndpointSide }[] = [];
  let current = starts[0], destination: DeskObject | undefined;
  while (current) {
    if (visited.has(current.object.id)) throw new Error('経路がループしています。初版は一本道だけをたどれます');
    visited.add(current.object.id); steps.push(current);
    const exit = opposite(current.side), binding = current.object[bindingField(exit)];
    if (binding) {
      const target = scene.find(o => o.id === binding.objectId);
      if (!target) throw new Error('経路の接続先がありません');
      if (target.id === id) throw new Error('経路が出発地点へ戻っています');
      // A receiving wayfinder is not a station: continue to its attached card.
      destination = target.type === 'wayfinder' && target.attachment
        ? scene.find(o => o.id === target.attachment!.objectId) : target;
      break;
    }
    const junction = current.object[junctionField(exit)];
    if (!junction) break;
    const peers = edges.flatMap(object => (['start','end'] as const)
      .filter(side => object[junctionField(side)] === junction).map(side => ({ object, side })));
    if (peers.length > 2) throw new Error('経路に分岐があります。初版では進路を選べないため発進しません');
    const next = peers.filter(p => p.object.id !== current.object.id);
    if (!next.length) break;
    current = next[0];
  }
  const rounding = buildJunctionRounding(scene), points: Point[] = [center(source)];
  const push = (p: Point) => { const last = points.at(-1)!; if (Math.hypot(p.x-last.x,p.y-last.y)>1e-8) points.push(p); };
  const trimmed = (object: DeskObject, side: EndpointSide): Point => {
    const e = endpoints(object), p = e[side], q = e[opposite(side)], d = rounding.get(object.id)?.[side] ?? 0;
    const length = Math.hypot(q.x-p.x,q.y-p.y);
    return !length ? p : {x:p.x+(q.x-p.x)*d/length,y:p.y+(q.y-p.y)*d/length};
  };
  steps.forEach(({object,side}, index) => {
    push(trimmed(object,side));
    const exit=opposite(side), end=trimmed(object,exit); push(end);
    const next=steps[index+1];
    if (next && (rounding.get(object.id)?.[exit] ?? 0)>0) {
      const to=trimmed(next.object,next.side), control=endpoints(object)[exit];
      // The same quadratic corner as the connector renderer, sampled for arc-length travel.
      for(let n=1;n<=24;n++){const t=n/24,s=1-t;push({x:s*s*end.x+2*s*t*control.x+t*t*to.x,y:s*s*end.y+2*s*t*control.y+t*t*to.y});}
    }
  });
  if(destination)push(center(destination));
  return {points,lineIds:[...visited],destinationId:destination?.id};
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
