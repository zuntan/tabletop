import { sharedReadDescriptions } from './read-tool-descriptions';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { DeskObject, Request } from './model';
import { assetFromBytes, importAssetFile, embeddedAsset, exportAsset } from './assets';

const json = (value: unknown): CallToolResult => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
const failure = (error: unknown): CallToolResult => ({ isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }] });
export function registerAssetTools(mcp: McpServer, request: (payload: Request) => Promise<unknown>) {
  mcp.registerTool('desk_asset_read', {
    description: sharedReadDescriptions.desk_asset_read,
    inputSchema: { id: z.string(), exportFile: z.boolean().default(false) },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, async ({ id, exportFile }): Promise<CallToolResult> => {
    try {
      const object = await request({ method: 'get', id }) as DeskObject;
      if (!['image', 'svg'].includes(object.type) || !object.src) throw new Error('Object is not an image/SVG');
      const asset = embeddedAsset(object.src);
      const path = exportFile ? await exportAsset(asset) : undefined;
      const metadata = { id, mimeType: asset.mimeType, byteLength: asset.bytes.length, path,
        ...(asset.mimeType === 'image/svg+xml' ? { svg: asset.bytes.toString('utf8') } : {}) };
      const result = json(metadata);
      if (asset.mimeType !== 'image/svg+xml') result.content.push({ type: 'image', mimeType: asset.mimeType, data: asset.bytes.toString('base64') });
      return result;
    } catch (error) { return failure(error); }
  });
  mcp.registerTool('desk_asset_import', {
    description: 'Add or replace an image/SVG from an absolute local file under TABLETOP_ASSET_ROOT (default /tmp), inline SVG source, or a base64 image data URL; exactly one source is required. Server reads files, never the browser. Max 5MB. For add, supply a unique id and optional geometry/title/url. snap defaults to desk (shared grid settings); exact bypasses the grid for this import without changing its global switch. Read placement.results for actual applied coordinates and grid corrections. For replace, only src changes: ID/type/position/size/title/link are preserved. One shared Undo. Use expectedRevision to prevent conflicts; on uncertain outcome inspect revision before retrying.',
    inputSchema: {
      id: z.string().min(1).max(100), mode: z.enum(['add', 'replace']).default('add'),
      source: z.union([z.object({ path: z.string().max(4096) }).strict(), z.object({ svg: z.string().max(5_000_000) }).strict(), z.object({ dataUrl: z.string().max(8_000_000) }).strict()]),
      x: z.number().finite().optional(), y: z.number().finite().optional(), width: z.number().finite().min(1).max(100_000).optional(), height: z.number().finite().min(35).max(100_000).optional(),
      title: z.string().max(100_000).optional(), url: z.string().max(4096).optional(),
      snap: z.enum(['desk', 'exact']).default('desk'),
      actor: z.string().min(1).max(100).default('agent-01'), expectedRevision: z.number().int().nonnegative().optional(),
    }, annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  }, async ({ id, mode, source, x, y, width, height, title, url, snap, actor, expectedRevision }): Promise<CallToolResult> => {
    try {
      if (mode === 'replace' && [x, y, width, height, title, url].some(value => value !== undefined)) throw new Error('Replacement accepts only source; geometry/title/link are preserved');
      const asset = 'path' in source ? await importAssetFile(source.path) : 'svg' in source
        ? assetFromBytes(Buffer.from(source.svg, 'utf8')) : embeddedAsset(source.dataUrl);
      if ('svg' in source && asset.mimeType !== 'image/svg+xml') throw new Error('Expected SVG source');
      if (mode === 'replace') {
        const snapshot = await request({ method: 'list' }) as { revision: number; objects: DeskObject[] };
        const object = snapshot.objects.find(object => object.id === id);
        if (!object || !['image', 'svg'].includes(object.type)) throw new Error('Replacement requires an image/SVG object');
        expectedRevision ??= snapshot.revision;
      }
      const operations = mode === 'replace' ? [{ kind: 'update' as const, id, patch: { src: asset.src } }]
        : [{ kind: 'add' as const, object: { id, type: asset.mimeType === 'image/svg+xml' ? 'svg' as const : 'image' as const,
          src: asset.src, x: x ?? 0, y: y ?? 0, width: width ?? 480, height: height ?? 354, text: title ?? id, ...(url !== undefined ? { url } : {}) } }];
      return json(await request({ method: 'execute', operations, snap, actor, expectedRevision }));
    } catch (error) { return failure(error); }
  });
}
