import type { DeskObject } from './model';
import { anchors, anchorPoint } from './geometry';
import { element } from './diagram-drawing';

/** UI-only relationships. Followers use their rectangle even though connector anchors are disabled. */
export function clipMembershipGuides(scene: DeskObject[], selectedIds: readonly string[]) {
  const objects = new Map(scene.map(object => [object.id, object]));
  const owners = new Map<string, DeskObject>();
  for (const clip of scene) if (clip.type === 'clip') for (const id of clip.clipMembers ?? []) owners.set(id, clip);
  return [...new Set(selectedIds)].flatMap(id => {
    const object = objects.get(id), clip = owners.get(id);
    if (!object || !clip) return [];
    const end = { x: clip.x + clip.width / 2, y: clip.y + clip.height / 2 };
    const rectangle = { ...object, type: 'rect' as const };
    const points = anchors.map(anchor => anchorPoint(rectangle, anchor));
    const distance = (point: {x:number;y:number}) => (point.x-end.x)**2+(point.y-end.y)**2;
    const start = points.reduce((nearest, point) => distance(point) < distance(nearest) ? point : nearest);
    return [{ id, clipId: clip.id, start, end }];
  });
}
export function drawClipMembershipGuides(layer: SVGGElement, scene: DeskObject[], selectedIds: readonly string[], zoom: number, color: string) {
  for (const guide of clipMembershipGuides(scene, selectedIds)) layer.append(element('line', {
    x1: guide.start.x, y1: guide.start.y, x2: guide.end.x, y2: guide.end.y,
    stroke: color, 'stroke-opacity': .6, 'stroke-width': 1.5 / zoom, 'stroke-dasharray': `${4 / zoom} ${4 / zoom}`,
    'pointer-events': 'none', 'aria-hidden': 'true', 'data-clip-membership': guide.id, 'data-owner-clip': guide.clipId,
  }));
}
