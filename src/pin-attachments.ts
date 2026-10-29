import type { DeskObject } from './model';
import { anchorPoint, snap, isConnectable, type Point } from './geometry';

export const isPinAttachmentTarget = (object: DeskObject, scene: DeskObject[] = []) =>
  !['label','wayfinder'].includes(object.type) && isConnectable(object,scene);
export function snapPinAttachment(point: Point, objects: DeskObject[], threshold: number) {
  return snap(point, objects.filter(o=>isPinAttachmentTarget(o,objects)), threshold);
}
export const wayfinderAnchors=['top','right','bottom','left'] as const;
export function attachmentOffset(object:DeskObject){
 const side=object.type==='wayfinder'?object.attachmentAnchor??'bottom':'bottom';
 return side==='top'?{x:object.width/2,y:0}:side==='left'?{x:0,y:object.height/2}:side==='right'?{x:object.width,y:object.height/2}:{x:object.width/2,y:object.height};
}
/** Test all four source anchors. Distance, not the target side or inside/outside, chooses attachment. */
export function snapWayfinderAttachment(object:DeskObject,objects:DeskObject[],threshold:number){
 let best:undefined|{point:Point;binding:{objectId:string;anchor:import('./geometry').Anchor};sourceAnchor:typeof wayfinderAnchors[number];distance:number};
 for(const sourceAnchor of wayfinderAnchors){
  const point=anchorPoint(object,sourceAnchor),candidate=snapPinAttachment(point,objects,threshold);if(!candidate)continue;
  const distance=Math.hypot(candidate.point.x-point.x,candidate.point.y-point.y);
  if(!best||distance<best.distance)best={...candidate,sourceAnchor,distance};
 }
 return best;
}
/** Pins and wayfinders follow only a directly attached shape/text/media; the resulting graph has no chains or cycles. */
export function resolvePinAttachments(objects: DeskObject[], before: DeskObject[]): DeskObject[] {
  const targets = new Map(objects.map(object => [object.id, object]));
  const previous = new Map(before.map(object => [object.id, object]));
  return objects.map(object => {
    const attachment = object.attachment;
    if (!attachment) return object;
    if (!['label','wayfinder'].includes(object.type)) throw new Error('Only pins and wayfinders can have attachments');
    const target = targets.get(attachment.objectId);
    if (!target || !isPinAttachmentTarget(target,objects)) {
      const old = previous.get(object.id)?.attachment;
      if (old?.objectId === attachment.objectId && previous.has(attachment.objectId))
        return { ...object, attachment: null };
      throw new Error('Pins can attach only to text, shapes or image/SVG/Mermaid cards');
    }
    const tip = anchorPoint(target, attachment.anchor);
    const offset=attachmentOffset(object);
    return { ...object, x: tip.x-offset.x, y: tip.y-offset.y };
  });
}
