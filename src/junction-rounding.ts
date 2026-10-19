import type { DeskObject } from './model';
import { endpoints, isConnector, type Point } from './geometry';
import { junctionField, type JunctionMember } from './connector-junctions';

export type LineRounding = { start: number; end: number; curves: { id: string; from: Point; control: Point; to: Point }[] };
/** Presentation only: logical endpoints and connection groups are never modified. */
export function buildJunctionRounding(scene: DeskObject[]): Map<string, LineRounding> {
  const groups = new Map<string, JunctionMember[]>(), result = new Map<string, LineRounding>();
  for (const object of scene.filter(isConnector)) for (const side of ['start', 'end'] as const) {
    const id = object[junctionField(side)];
    if (id) { const members = groups.get(id) ?? []; members.push({ object, side }); groups.set(id, members); }
  }
  const entry = (id: string) => { let value = result.get(id); if (!value) { value = { start: 0, end: 0, curves: [] }; result.set(id, value); } return value; };
  for (const [id, members] of groups) {
    if (members.length !== 2 || members[0].object.id === members[1].object.id) continue;
    if (members.some(m => m.object.strokeWidth <= 0 || (m.object[m.side === 'start' ? 'startMarker' : 'endMarker'] ?? 'none') !== 'none')) continue;
    const requested = Math.max(...members.map(m => m.object.junctionRounding ?? 0));
    if (!requested) continue;
    const vectors = members.map(({ object, side }) => {
      const points = endpoints(object), joint = points[side], other = points[side === 'start' ? 'end' : 'start'];
      const dx = other.x - joint.x, dy = other.y - joint.y, length = Math.hypot(dx, dy);
      return { joint, length, x: dx / length, y: dy / length };
    });
    const [a, b] = vectors;
    if (!a.length || !b.length || Math.hypot(a.joint.x - b.joint.x, a.joint.y - b.joint.y) > .001 || Math.abs(a.x * b.y - a.y * b.x) < 1e-6) continue;
    const distance = Math.min(requested, a.length * .45, b.length * .45);
    members.forEach(m => { entry(m.object.id)[m.side] = distance; });
    const owner = [...members].sort((a, b) => (b.object.junctionRounding ?? 0) - (a.object.junctionRounding ?? 0) || a.object.id.localeCompare(b.object.id))[0];
    entry(owner.object.id).curves.push({ id, control: a.joint,
      from: { x: a.joint.x + a.x * distance, y: a.joint.y + a.y * distance },
      to: { x: b.joint.x + b.x * distance, y: b.joint.y + b.y * distance } });
  }
  return result;
}
