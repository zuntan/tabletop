import type { DeskObject } from './model';
import { bounds, anchorPoint, type Anchor } from './geometry';
import { clipFor } from './clip-bundles';
import { clipAppearance } from './clip-appearance';
import { fileFor, fileGroup } from './clear-files';
import { DeskError } from './desk-errors';

export type StackDirection = 'front' | 'forward' | 'backward' | 'back';
type Layer = { id: string; objects: DeskObject[] };

function overlaps(a: Layer, b: Layer) {
  return a.objects.some(first => b.objects.some(second => {
    const x = bounds(first), y = bounds(second);
    return x.x < y.x + y.width && y.x < x.x + x.width && x.y < y.y + y.height && y.y < x.y + x.height;
  }));
}

/** Move selected layers without reversing them or moving any selected layer in the opposite direction. */
function reorderLayers(layers: Layer[], selected: Set<string>, direction: StackDirection, checkOverlap: boolean): Layer[] {
  const forward = direction === 'front' || direction === 'forward';
  if (direction === 'front' || direction === 'back') {
    const moving = layers.filter(layer => selected.has(layer.id));
    const rest = layers.filter(layer => !selected.has(layer.id));
    return forward ? [...rest, ...moving] : [...moving, ...rest];
  }
  const candidates = layers.map((_, index) => index);
  if (!forward) candidates.reverse();
  const target = candidates.find(index => !selected.has(layers[index].id) && layers.some((layer, position) =>
    selected.has(layer.id) && (forward ? position < index : position > index) && (!checkOverlap || overlaps(layer, layers[index]))));
  if (target === undefined) return layers;
  const moving = layers.filter((layer, index) => selected.has(layer.id) && (forward ? index < target : index > target));
  const moved = new Set(moving.map(layer => layer.id));
  const rest = layers.filter(layer => !moved.has(layer.id));
  const insertion = rest.indexOf(layers[target]) + (forward ? 1 : 0);
  return [...rest.slice(0, insertion), ...moving, ...rest.slice(insertion)];
}

function layersFor(scene: DeskObject[]): Layer[] {
  const emitted = new Set<string>();
  const layers: Layer[] = [];
  for (const object of scene) {
    if (emitted.has(object.id)) continue;
    const objects = object.type === 'label'
      ? scene.filter(item => item.type === 'label' && item.seriesId === object.seriesId)
      : fileGroup(scene, object.id);
    for (const member of objects) emitted.add(member.id);
    layers.push({ id: objects.at(-1)!.id, objects });
  }
  return layers;
}

export function orderObjects(scene: DeskObject[], ids: string[], direction: StackDirection, actor: string): DeskObject[] {
  const selected = new Set(ids);
  const map = new Map(scene.map(object => [object.id, object]));
  const layers = layersFor(scene);
  const sceneTargets = new Set<string>();
  const paperTargets = new Map<string, Set<string>>();
  for (const id of selected) {
    const object = map.get(id);
    if (!object) throw new Error(`Unknown object: ${id}`);
    const layer = layers.find(layer => layer.objects.some(member => member.id === id))!;
    const file = fileFor(scene, id);
    if (file && file.id !== id) throw new DeskError('fileOrderFrozen');
    if (actor === 'human' && layer.objects.some(member => member.locked)) throw new DeskError('orderLocked');
    const clip = clipFor(scene, id);
    if (clip && clip.id !== id && !selected.has(clip.id)) {
      const papers = paperTargets.get(clip.id) ?? new Set<string>();
      papers.add(id);
      paperTargets.set(clip.id, papers);
    } else if (!clip || clip.id === id) sceneTargets.add(layer.id);
  }

  for (const [id, targets] of paperTargets) {
    const clip = map.get(id)!;
    const papers = clip.clipMembers!.map(id => ({ id, objects: [map.get(id)!] }));
    const members = reorderLayers(papers, targets, direction, false).map(layer => layer.id);
    if (members.every((id, index) => id === clip.clipMembers![index])) continue;
    map.set(id, { ...clip, clipMembers: members });
    if (members[0] !== clip.clipMembers![0]) {
      const base = map.get(members[0])!;
      const appearance = clipAppearance(clip, base);
      const local = anchorPoint({ ...base, x: 0, y: 0 }, (clip.clipAnchor ?? 'top-left') as Anchor);
      const x = clip.x - appearance.insetX + appearance.boundsWidth / 2 - local.x;
      const y = clip.y - appearance.insetY + appearance.boundsHeight / 2 - local.y;
      const callout = base.callout && !base.callout.binding
        ? { ...base.callout, x: base.callout.x + x - base.x, y: base.callout.y + y - base.y } : base.callout;
      map.set(base.id, { ...base, x, y, ...(callout ? { callout } : {}) });
    }
  }
  return reorderLayers(layers, sceneTargets, direction, true).flatMap(layer => layer.objects.map(object => map.get(object.id)!));
}
