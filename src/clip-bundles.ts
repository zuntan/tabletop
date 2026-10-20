import { clipAppearance } from './clip-appearance';
import type { DeskObject, Operation } from './model';
import { anchorPoint, type Anchor, type Point } from './geometry';
import { randomUuid } from './portable-crypto';

export const clipTarget = (object: DeskObject) => ['text','image','svg','mermaid','web','link'].includes(object.type);
export function clipFor(objects: DeskObject[], id: string) {
  return objects.find(o => o.type === 'clip' && (o.id === id || o.clipMembers?.includes(id)));
}
export function clipFollower(objects: DeskObject[], id: string) {
  return objects.some(o => o.type === 'clip' && o.clipMembers?.slice(1).includes(id));
}
export function clipGroup(objects: DeskObject[], id: string): DeskObject[] {
  const clip = clipFor(objects,id);
  return clip ? [...(clip.clipMembers ?? []).map(id => objects.find(o => o.id === id)!),clip].filter(Boolean) : objects.filter(o=>o.id===id);
}
export function bundleOperations(objects: DeskObject[], ids: string[]): Operation[] {
  const members = ids.filter(id => { const o=objects.find(o=>o.id===id);return o && clipTarget(o) && !o.locked && !clipFor(objects,id); });
  if (!members.length) return [];
  return [{kind:'add',object:{id:'clip-'+randomUuid(),type:'clip',clipMembers:members,clipAnchor:'top-left',clipOffset:32,clipSize:64,clipStyle:'binder',fill:'#26313d'}}];
}
export function unbundleOperations(objects: DeskObject[], ids: string[]): Operation[] {
  return [...new Set(ids.map(id=>clipFor(objects,id)?.id).filter((id):id is string=>!!id))]
    .filter(id=>!clipGroup(objects,id).some(o=>o.locked)).map(id=>({kind:'delete',id}));
}
/** Membership is the sole source of truth. No hidden per-card connection state is persisted. */
export function resolveClips(input: DeskObject[], before: DeskObject[] = []): DeskObject[] {
  const map=new Map(input.map(o=>[o.id,{...o}])), previous=new Map(before.map(o=>[o.id,o]));
  const owners=new Map<string,string>();
  for (const source of input.filter(o=>o.type==='clip')) {
    const clip=map.get(source.id)!; const members=clip.clipMembers ?? [];
    const old=previous.get(clip.id);
    if ((old?.clipMembers?.length && !members.length) || members.some(id=>!map.has(id) && old?.clipMembers?.includes(id))) {map.delete(clip.id);continue;}
    if (new Set(members).size!==members.length) throw new Error('Duplicate clip member');
    for(const id of members) {
      const member=map.get(id);
      if(!member || !clipTarget(member)) throw new Error('Clips require text/image/SVG/Mermaid/web/link cards');
      if(owners.has(id)) throw new Error('A card can belong to only one clip; nesting is not supported');
      owners.set(id,clip.id);
    }
    const size=clip.clipSize ?? 64;
    const appearance=clipAppearance(clip);
    Object.assign(clip,{clipMembers:[...members],clipAnchor:clip.clipAnchor ?? 'top-left',clipOffset:clip.clipOffset ?? 32,clipSize:size,clipStyle:clip.clipStyle ?? 'binder',width:appearance.boundsWidth,height:appearance.boundsHeight});
    if(!members.length) continue;
    const base=map.get(members[0])!, oldBase=previous.get(base.id);
    // Existing MCP position edits to any member or the clip translate the whole bundle too.
    if(old?.clipMembers?.[0]===base.id && oldBase && base.x===oldBase.x && base.y===oldBase.y) {
      const moved=(clip.x!==old.x || clip.y!==old.y) ? {dx:clip.x-old.x,dy:clip.y-old.y}
        : members.slice(1).map(id=>({now:map.get(id)!,old:previous.get(id)})).filter(pair=>old.clipMembers?.includes(pair.now.id))
          .find(pair=>pair.old && (pair.now.x!==pair.old.x || pair.now.y!==pair.old.y));
      if(moved) {const delta='dx' in moved ? moved : {dx:moved.now.x-moved.old!.x,dy:moved.now.y-moved.old!.y};base.x+=delta.dx;base.y+=delta.dy;
        if(base.callout&&!base.callout.binding) base.callout={...base.callout,x:base.callout.x+delta.dx,y:base.callout.y+delta.dy};}
    }
    const anchor=anchorPoint(base,clip.clipAnchor as Anchor);
    const vx=base.x+base.width/2-anchor.x,vy=base.y+base.height/2-anchor.y,length=Math.hypot(vx,vy)||1;
    for(let i=1;i<members.length;i++) {
      const member=map.get(members[i])!, local=anchorPoint({...member,x:0,y:0},clip.clipAnchor as Anchor), distance=i*clip.clipOffset!;
      const x=anchor.x+vx/length*distance-local.x,y=anchor.y+vy/length*distance-local.y;
      const dx=x-member.x,dy=y-member.y;member.x=x;member.y=y;
      if(member.callout&&!member.callout.binding) member.callout={...member.callout,x:member.callout.x+dx,y:member.callout.y+dy};
    }
    clip.x=anchor.x+appearance.insetX-clip.width/2;clip.y=anchor.y+appearance.insetY-clip.height/2;
  }
  const followers=new Set([...map.values()].filter(o=>o.type==='clip').flatMap(o=>o.clipMembers?.slice(1)??[]));
  for(const object of map.values()) {
    for(const field of ['startBinding','endBinding','attachment'] as const) if(object[field] && followers.has(object[field]!.objectId)) object[field]=null;
    if(object.callout?.binding && followers.has(object.callout.binding.objectId)) object.callout={...object.callout,binding:null};
  }
  // Each bundle is a single contiguous z-order block; first paper is at the back.
  const emitted=new Set<string>(), result:DeskObject[]=[];
  for(const original of input) {
    const object=map.get(original.id);if(!object)continue;
    const owner=owners.get(object.id) ?? (object.type==='clip' && object.clipMembers?.length ? object.id : undefined);
    if(owner && map.has(owner)) {
      if(emitted.has(owner))continue;emitted.add(owner);
      const clip=map.get(owner)!;result.push(...clip.clipMembers!.map(id=>map.get(id)!),clip);
    } else result.push(object);
  }
  return result;
}

/** Return a complete move/peel operation set, or null to use the existing gesture rules. */
export function clipMoveOperations(scene: DeskObject[], ids: string[], dx:number,dy:number,detach:boolean): Operation[] | null {
  if(!ids.some(id=>clipFor(scene,id)?.clipMembers?.length))return null;
  const operations:Operation[]=[],done=new Set<string>();
  for(const id of ids) {
    const object=scene.find(o=>o.id===id)!; const clip=clipFor(scene,id);
    if(clip) {
      if(done.has(clip.id) || clipGroup(scene,id).some(o=>o.locked)) continue;
      if(detach && object.type!=='clip') {
        operations.push({kind:'update',id:clip.id,patch:{clipMembers:clip.clipMembers!.filter(member=>member!==id)}});
        operations.push({kind:'update',id,patch:{x:object.x+dx,y:object.y+dy,
          ...(object.callout&&!object.callout.binding?{callout:{...object.callout,x:object.callout.x+dx,y:object.callout.y+dy}}:{})}});
      } else {
        const base=scene.find(o=>o.id===clip.clipMembers?.[0]); const target=base??clip;
        operations.push({kind:'update',id:target.id,patch:{x:target.x+dx,y:target.y+dy,
          ...(target.callout&&!target.callout.binding?{callout:{...target.callout,x:target.callout.x+dx,y:target.callout.y+dy}}:{})}});
      }
      done.add(clip.id);
    } else if(!object.locked) {
      operations.push({kind:'update',id,patch:{x:object.x+dx,y:object.y+dy,
        ...(object.x2!==undefined?{x2:object.x2+dx,y2:object.y2!+dy}:{}),
        ...(object.callout&&!object.callout.binding?{callout:{...object.callout,x:object.callout.x+dx,y:object.callout.y+dy}}:{})}});
    }
  }
  return operations;
}
export function clipDropTarget(scene:DeskObject[],point:Point,zoom:number,excluded:string[]) {
  return scene.slice().reverse().find(o=>o.type==='clip' && o.clipMembers?.length && !clipGroup(scene,o.id).some(m=>m.locked || excluded.includes(m.id)) && Math.hypot(point.x-(o.x+o.width/2),point.y-(o.y+o.height/2))<=Math.max(24/zoom,o.width*.65));
}
