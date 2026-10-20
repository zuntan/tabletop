import type { DeskObject } from './model';
import { anchorPoint, snap, isConnectable, type Point } from './geometry';

export const isPinAttachmentTarget = (object: DeskObject) =>
  object.type !== 'label' && isConnectable(object);
export function snapPinAttachment(point: Point, objects: DeskObject[], threshold: number) {
  return snap(point, objects.filter(isPinAttachmentTarget), threshold);
}
/** Pins follow only a directly attached shape/text/media; the resulting graph has no chains or cycles. */
export function resolvePinAttachments(objects: DeskObject[], before: DeskObject[]): DeskObject[] {
  const targets = new Map(objects.map(object => [object.id, object]));
  const previous = new Map(before.map(object => [object.id, object]));
  return objects.map(object => {
    const attachment = object.attachment;
    if (!attachment) return object;
    if (object.type !== 'label') throw new Error('Only pins can have attachments');
    const target = targets.get(attachment.objectId);
    if (!target || !isPinAttachmentTarget(target)) {
      const old = previous.get(object.id)?.attachment;
      if (old?.objectId === attachment.objectId && previous.has(attachment.objectId))
        return { ...object, attachment: null };
      throw new Error('Pins can attach only to text, shapes or image/SVG/Mermaid cards');
    }
    const tip = anchorPoint(target, attachment.anchor);
    return { ...object, x: tip.x - object.width / 2, y: tip.y - object.height };
  });
}
