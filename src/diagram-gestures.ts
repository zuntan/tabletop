import {headSelectedProp} from './prop-selection';
import {rulerFor,rulerMoveOperations} from './ruler-layout';
import {fileFor,fileMoveOperations} from './clear-files';
import { clipMoveOperations, clipFor, clipDropTarget, clipTarget, clipGroup } from './clip-bundles';
import { snapPinAttachment,snapWayfinderAttachment } from './pin-attachments';
import { randomUuid } from './portable-crypto';
import { junctionMembers, junctionField, bindingField, snapConnectorEndpoint } from './connector-junctions';
import { pinScreenObject } from './pin-series';
import type { DeskObject, Operation } from './model';
import { endpoints, isConnector, resolveConnections, snap, type Point } from './geometry';
import { gridPoint, gridMoveDelta } from './grid';
import type { GridSettings } from './grid-settings';

export type Gesture = {
  mode: 'move' | 'resize' | 'callout' | 'start' | 'end' | 'pan' | 'marquee';
  start: Point;
  screen: Point;
  originals: DeskObject[];
  scene: DeskObject[];
  snapScene?: DeskObject[];
  preview: DeskObject[];
  revision: number;
  camera: Point;
  additive: string[];
  grid?: boolean;
  gridSettings?: GridSettings;
  anchorId?: string;
  detach?: boolean;
  junctionId?: string;
  endpointMoved?: boolean;
};
/** Shared by endpoint preview highlights and the committed operation. */
export function endpointSnap(gesture: Gesture, object: DeskObject, point: Point, zoom: number) {
  const side = gesture.mode === 'start' ? 'start' : 'end';
  const sourceGroup = object[junctionField(side)];
  const objects = (gesture.snapScene ?? gesture.scene)
    .filter(o => o.id !== object.id && !clipFor(gesture.scene,o.id)?.clipMembers?.slice(1).includes(o.id))
    .map(o => pinScreenObject(o, zoom));
  let shape = gesture.detach ? null : snap(point, objects, 18 / zoom);
  let line = gesture.detach ? null : snapConnectorEndpoint(point, objects, 18 / zoom, object.id, sourceGroup ?? undefined);
  if (line && (!shape || Math.hypot(point.x-line.point.x, point.y-line.point.y) < Math.hypot(point.x-shape.point.x, point.y-shape.point.y))) {
    shape = null;
    const targetGroup = line.object[junctionField(line.side)];
    const members = [...(sourceGroup ? junctionMembers(gesture.scene, sourceGroup) : [{object, side}]),
      ...(targetGroup ? junctionMembers(gesture.scene, targetGroup) : [{object: line.object, side: line.side}])];
    const unique = [...new Map(members.map(m => [m.object.id + ':' + m.side, m])).values()];
    if (new Set(unique.map(m => m.object.id)).size !== unique.length) line = null;
  } else line = null;
  return {objects, shape, line};
}
export function gestureOperations(gesture: Gesture, point: Point, zoom: number): Operation[] {
  let dx = point.x - gesture.start.x, dy = point.y - gesture.start.y;
  if (dx === 0 && dy === 0 && !(gesture.endpointMoved && (gesture.mode === 'start' || gesture.mode === 'end'))) return []; // A click alone must not change connections.
  const movable = gesture.originals.filter(object => !object.locked);
  const selectedAnchor = movable.find(object => object.id === gesture.anchorId) ?? movable[0];
  const anchor=selectedAnchor?(fileFor(gesture.scene,selectedAnchor.id)??selectedAnchor):undefined;
  if (gesture.grid && gesture.mode === 'move' && anchor) {
    const delta = gridMoveDelta(anchor, { x: dx, y: dy }, gesture.gridSettings); dx = delta.x; dy = delta.y;
    if (dx === 0 && dy === 0) return [];
  }
  if(gesture.mode!=='move'&&gesture.originals.some(o=>fileFor(gesture.scene,o.id)))return [];
  if (gesture.mode === 'move') {
    const filed=fileMoveOperations(gesture.scene,movable.map(o=>o.id),dx,dy);if(filed)return filed;
    const ruled=rulerMoveOperations(gesture.scene,movable.map(o=>o.id),dx,dy,!!gesture.detach,point,zoom);if(ruled)return ruled;
    const bundled=clipMoveOperations(gesture.scene,gesture.detach&&gesture.anchorId?[gesture.anchorId]:movable.map(o=>o.id),dx,dy,!!gesture.detach);
    if(bundled) return bundled;
    if(movable.length===1 && !gesture.detach) {
      const object=movable[0];
      if(object.type==='clip' && !object.clipMembers?.length) {
        const next={x:object.x+object.width/2+dx,y:object.y+object.height*.5+dy};
        const target=snap(next,gesture.scene.filter(o=>clipTarget(o)&&!o.locked&&!clipFor(gesture.scene,o.id)),24/zoom);
        if(target) return [{kind:'update',id:object.id,patch:{clipMembers:[target.binding.objectId],clipAnchor:target.binding.anchor as Exclude<typeof target.binding.anchor,'center'>}}];
      } else if(clipTarget(object) && !clipFor(gesture.scene,object.id)&&!rulerFor(gesture.scene,object.id)) {
        const clip=clipDropTarget(gesture.scene,point,zoom,[object.id]);
        if(clip) return [{kind:'update',id:clip.id,patch:{clipMembers:[...clip.clipMembers!,object.id]}}];
      }
    }
  }
  const patches = new Map<string, Partial<DeskObject>>();
  const put = (id: string, patch: Partial<DeskObject>) => patches.set(id, { ...patches.get(id), ...patch });
  const selected = new Set(movable.map(o => o.id));
  const movingJunctions = new Set<string>();
  movable.forEach(object => {
    let patch: Partial<DeskObject>;
    if (gesture.mode === 'callout' && object.callout) {
      const next = { x: object.callout.x + dx, y: object.callout.y + dy };
      const candidate = gesture.detach ? null : snap(next, (gesture.snapScene ?? gesture.scene)
        .filter(o => o.id !== object.id && !clipFor(gesture.scene,o.id)?.clipMembers?.slice(1).includes(o.id)).map(o => pinScreenObject(o, zoom)), 18 / zoom);
      const position = candidate?.point ?? (gesture.grid ? gridPoint(next, gesture.gridSettings) : next);
      patch = { callout: { ...object.callout, ...position, binding: candidate?.binding ?? null } };
    } else if (gesture.mode === 'start' || gesture.mode === 'end') {
      const points = endpoints(object), side = gesture.mode;
      const next = { x: points[side].x + dx, y: points[side].y + dy };
      const jf = junctionField(side), bf = bindingField(side);
      const sourceGroup = object[jf];
      const {shape, line: candidate} = endpointSnap(gesture, object, next, zoom);
      const position = candidate?.point ?? shape?.point ?? (gesture.grid ? gridPoint(next, gesture.gridSettings) : next);
      patch = side === 'start' ? { x: position.x, y: position.y } : { x2: position.x, y2: position.y };
      patch[bf] = candidate ? null : shape?.binding ?? null;
      if (gesture.detach) patch[jf] = null;
      else if (candidate) {
        const targetGroup = candidate.object[junctionField(candidate.side)];
        const members = [
          ...(sourceGroup ? junctionMembers(gesture.scene, sourceGroup) : [{ object, side }]),
          ...(targetGroup ? junctionMembers(gesture.scene, targetGroup) : [{ object: candidate.object, side: candidate.side }]),
        ];
        const unique = [...new Map(members.map(m => [m.object.id + ':' + m.side, m])).values()];
        if (new Set(unique.map(m => m.object.id)).size === unique.length) {
          const id = targetGroup ?? sourceGroup ?? (gesture.junctionId ??= 'junction-' + randomUuid());
          for (const member of unique) put(member.object.id, {
            [junctionField(member.side)]: id,
            ...(member.side === 'start' ? { x: position.x, y: position.y } : { x2: position.x, y2: position.y }),
          });
          patch[jf] = id;
        } else {
          // A line cannot attach both ends to one point: simply do not attach.
          patch = side === 'start' ? { x: next.x, y: next.y } : { x2: next.x, y2: next.y };
          patch[bf] = null;
        }
      }
      if (sourceGroup && !gesture.detach) movingJunctions.add(sourceGroup);
    } else if (gesture.mode === 'resize') {
      if(headSelectedProp(object))return;
      const corner = { x: object.x + object.width + dx, y: object.y + object.height + dy };
      const next = gesture.grid ? gridPoint(corner, gesture.gridSettings) : corner;
      patch = { width: Math.max(1, next.x - object.x), height: Math.max(1, next.y - object.y) };
    } else if (isConnector(object)) {
      const { start, end } = endpoints(object);
      patch = { x: start.x + dx, y: start.y + dy, x2: end.x + dx, y2: end.y + dy, startBinding: object.startBinding && selected.has(object.startBinding.objectId) ? object.startBinding : null,
        endBinding: object.endBinding && selected.has(object.endBinding.objectId) ? object.endBinding : null };
      for (const side of ['start', 'end'] as const) if (object[junctionField(side)]) movingJunctions.add(object[junctionField(side)]!);
    } else if(object.type==='wayfinder'){
      const moved={...object,x:object.x+dx,y:object.y+dy};
      if(object.attachment&&selected.has(object.attachment.objectId))patch={x:moved.x,y:moved.y};
      else{
        const targets=(gesture.snapScene??gesture.scene).filter(o=>!selected.has(o.id)&&!clipFor(gesture.scene,o.id)?.clipMembers?.slice(1).includes(o.id));
        const candidate=movable.length===1&&!gesture.detach?snapWayfinderAttachment(moved,targets,18/zoom):undefined;
        patch={x:moved.x,y:moved.y,...(candidate?{attachment:candidate.binding,attachmentAnchor:candidate.sourceAnchor}:object.attachment?{attachment:null}:{})};
      }
    } else if (object.type === 'label') {
      const next = { x: object.x + object.width / 2 + dx, y: object.y + object.height + dy };
      if (object.attachment && selected.has(object.attachment.objectId)) {
        patch = { x: object.x + dx, y: object.y + dy };
      } else {
        const candidate = movable.length === 1 && !gesture.detach
          ? snapPinAttachment(next, (gesture.snapScene ?? gesture.scene).filter(o => !selected.has(o.id) && !clipFor(gesture.scene,o.id)?.clipMembers?.slice(1).includes(o.id)), 18 / zoom) : null;
        const position = candidate?.point ?? next;
        patch = { x: position.x - object.width / 2, y: position.y - object.height,
          ...(candidate || object.attachment ? { attachment: candidate?.binding ?? null } : {}) };
      }
    } else {
      patch = { x: object.x + dx, y: object.y + dy,
        ...(object.callout && !object.callout.binding ? { callout: { ...object.callout, x: object.callout.x + dx, y: object.callout.y + dy } } : {}) };
    }
    put(object.id, patch);
    return object;
  });
  // Glue belongs to the shape. Moving a joined line peels the point group away
  // without breaking line-to-line joints or pulling the shape.
  for (const id of movingJunctions) for (const { object, side } of junctionMembers(gesture.scene, id)) {
    const binding = object[bindingField(side)];
    if (binding && !selected.has(binding.objectId) && !Object.hasOwn(patches.get(object.id) ?? {}, bindingField(side))) put(object.id, { [bindingField(side)]: null });
  }
  return [...patches].map(([id, patch]) => ({ kind: 'update' as const, id, patch }));
}
export function gesturePreview(gesture: Gesture, point: Point, zoom: number): DeskObject[] {
  const operations = gestureOperations(gesture, point, zoom);
  const updates = new Map(operations.flatMap(op => op.kind === 'update' ? [[op.id, op.patch] as const] : []));
  if(gesture.mode==='resize'&&gesture.originals.some(o=>o.type==='ruler'))return gesture.scene.map(o=>({...o,...updates.get(o.id)}));
  return resolveConnections(gesture.scene.map(o => ({ ...o, ...updates.get(o.id) })), gesture.scene);
}
export function endpointDragPoint(gesture: Gesture, point: Point): Point {
  const side = gesture.mode === 'start' ? 'start' : 'end';
  const initial = endpoints(gesture.originals[0])[side];
  return { x: initial.x + point.x - gesture.start.x, y: initial.y + point.y - gesture.start.y };
}
