import type { Desk } from './model';

/** One browser-side snapshot, without embedded asset payloads. */
export function deskContextSnapshot(desk: Desk) {
  const objects = desk.list();
  const connections = objects.filter(object => object.type === 'line').map(object => ({
    id: object.id, type: object.type,
    startMarker: object.startMarker, endMarker: object.endMarker,
    start: { x: object.x, y: object.y, binding: object.startBinding ?? null },
    end: { x: object.x2, y: object.y2, binding: object.endBinding ?? null },
  }));
  const settings = desk.listSettings();
  return { ...desk.summary(), selection: desk.selected(), aiPointing: desk.pointed(), objects, connections,
    settings: { ...settings, series: settings.series.map(series => ({ ...series,
      members: objects.filter(object => object.seriesId === series.id).map(object => ({ id: object.id, number: object.number, text: object.text, description: object.description ?? '' })),
    })) } };
}

export function deskContext(desk: Desk, sinceRevision: number, limit: number) {
  return { ...deskContextSnapshot(desk), history: desk.getChanges(sinceRevision, limit) };
}
