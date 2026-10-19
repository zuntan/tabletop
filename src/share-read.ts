import { publishObject } from './object-properties';
import type { Desk } from './model';
import { deskContextSnapshot } from './desk-context';

export type ShareTool = 'desk_context' | 'desk_get' | 'desk_asset_read';

/** Snapshot metadata and content in the same synchronous browser turn. */
export function shareRead(desk: Desk, tool: ShareTool, expectedSessionId: string, id?: string) {
  if (desk.sessionId !== expectedSessionId) throw new Error('Shared desk session changed');
  const stamp = { sessionId: desk.sessionId, revision: desk.revision, capturedAt: new Date().toISOString() };
  if (tool === 'desk_context') return { ...deskContextSnapshot(desk), ...stamp };
  if (!id) throw new Error('id is required');
  const object = desk.get(id);
  if (tool === 'desk_asset_read') {
    if (!['image', 'svg'].includes(object.type)) throw new Error('Object is not an image/SVG');
    return { ...stamp, object: publishObject(object) };
  }
  const { src, ...metadata } = publishObject(object);
  return { ...metadata, ...desk.imageGeometry.describe(object),
    ...(src ? { asset: { source: src.startsWith('data:') ? 'embedded' : src, length: src.length } } : {}), ...stamp };
}
