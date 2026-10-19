import type { DeskObject } from './model';
import { endpoints, isConnector, withEndpoints, type Point } from './geometry';

export type EndpointSide = 'start' | 'end';
export const junctionField = (side: EndpointSide) => side === 'start' ? 'startJunction' : 'endJunction';
export const bindingField = (side: EndpointSide) => side === 'start' ? 'startBinding' : 'endBinding';
export type JunctionMember = { object: DeskObject; side: EndpointSide };
export function junctionMembers(objects: DeskObject[], id: string): JunctionMember[] {
  return objects.filter(isConnector).flatMap(object => (['start', 'end'] as const)
    .filter(side => object[junctionField(side)] === id).map(side => ({ object, side })));
}
export function snapConnectorEndpoint(point: Point, objects: DeskObject[], threshold: number, excludeId: string, excludeGroup?: string) {
  let closest: { point: Point; object: DeskObject; side: EndpointSide } | null = null, distance = threshold;
  for (const object of objects.slice().reverse()) {
    if (!isConnector(object) || object.id === excludeId) continue;
    const points = endpoints(object);
    for (const side of ['start', 'end'] as const) {
      if (excludeGroup && object[junctionField(side)] === excludeGroup) continue;
      const p = points[side], d = Math.hypot(point.x - p.x, point.y - p.y);
      if (d <= distance && (!closest || d < distance)) { distance = d; closest = { point: p, object, side }; }
    }
  }
  return closest;
}
/** Resolve independent point groups, never traverse through a line to its other endpoint. */
export function resolveJunctions(objects: DeskObject[], before: DeskObject[] = []): DeskObject[] {
  const previous = new Map(before.map(o => [o.id, o]));
  const groups = new Map<string, JunctionMember[]>();
  for (const object of objects) for (const side of ['start', 'end'] as const) {
    const id = object[junctionField(side)];
    if (!id) continue;
    if (!isConnector(object)) throw new Error('Junctions are only supported on lines');
    const members = groups.get(id) ?? []; members.push({ object, side }); groups.set(id, members);
  }
  const updates = new Map<string, DeskObject>();
  for (const members of groups.values()) {
    if (new Set(members.map(m => m.object.id)).size !== members.length) throw new Error('A junction cannot contain both ends of one line');
    const moved = members.filter(({ object, side }) => {
      const old = previous.get(object.id);
      if (!old || old[junctionField(side)] !== object[junctionField(side)]) return false;
      const p = endpoints(object)[side], q = endpoints(old)[side];
      return p.x !== q.x || p.y !== q.y;
    });
    const bound = members.filter(m => m.object[bindingField(m.side)]);
    const leader = bound.find(m => moved.includes(m)) ?? bound[0] ?? moved[0] ?? members[0];
    const position = endpoints(leader.object)[leader.side];
    // Conflicting explicitly moved endpoints cannot be satisfied by a single point.
    if (!bound.length && moved.some(m => {
      const p = endpoints(m.object)[m.side]; return p.x !== position.x || p.y !== position.y;
    })) throw new Error('Conflicting junction positions in one batch');
    for (const { object, side } of members) {
      let next = updates.get(object.id) ?? object;
      if (members.length < 2) {
        // Deletion or Alt detachment leaves no orphan junction metadata.
        next = { ...next, [junctionField(side)]: null };
      } else {
        const points = endpoints(next);
        const binding = next[bindingField(side)];
        if (binding && (points[side].x !== position.x || points[side].y !== position.y))
          next = { ...next, [bindingField(side)]: null };
        points[side] = position; next = withEndpoints(next, points.start, points.end);
      }
      updates.set(object.id, next);
    }
  }
  return objects.map(object => updates.get(object.id) ?? object);
}
