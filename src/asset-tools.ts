import {deskTargetFields,deskTargetDescription,type DeskRequestFactory} from './desk-target';
import { sharedReadDescriptions } from './read-tool-descriptions';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { DeskObject, Request } from './model';
import { assetFromBytes, importAssetFile, embeddedAsset, exportAsset } from './assets';

const json = (value: unknown): CallToolResult => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
const failure = (error: unknown): CallToolResult => ({ isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }] });
export function registerAssetTools(mcp: McpServer, forDesk: DeskRequestFactory) {
  mcp.registerTool('desk_raster', {
    description: deskTargetDescription+'Experimental browser-side transparent PNG capture of exactly one AI-pointed text card. Read-only; no deletion, camera or selection change. Includes current rendered Markdown, frame, stamp and reactions; excludes attached parts, wallpaper and pointing frames. Returns image and exported local path for desk_asset_import, dimensions, world bounds, revision and browser raster/PNG timings. Approximate system-font rendering; max 4096 per side and 8M pixels. Point at one card first. Multiple cards and other types are not yet supported.',
    inputSchema: { ...deskTargetFields, scale: z.number().finite().min(.1).max(3).default(1) },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, async ({ deskId, scale }): Promise<CallToolResult> => {
    try {
      const request=forDesk(deskId);
      const rendered = await request({ method: 'raster', scale }) as { dataUrl: string; [key: string]: unknown };
      const { dataUrl, ...metadata } = rendered;
      const asset = embeddedAsset(dataUrl);
      const path = await exportAsset(asset);
      const result = json({ ...metadata, mimeType: asset.mimeType, byteLength: asset.bytes.length, path });
      result.content.push({ type: 'image', mimeType: asset.mimeType, data: asset.bytes.toString('base64') });
      return result;
    } catch (error) { return failure(error); }
  });
  mcp.registerTool('desk_asset_read', {
    description: deskTargetDescription+sharedReadDescriptions.desk_asset_read,
    inputSchema: { ...deskTargetFields, id: z.string(), exportFile: z.boolean().default(false) },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, async ({ deskId, id, exportFile }): Promise<CallToolResult> => {
    try {
      const request=forDesk(deskId);
      const object = await request({ method: 'get', id }) as DeskObject;
      if (object.type === 'mermaid'||object.type==='qrcode'||(object.type==='link'&&!object.deskPath&&object.linkDisplay==='qr')) {
        const rendered = await request({ method:object.type==='mermaid'?'mermaid_render':'qr_render', id }) as { svg: string; revision: number; mermaidSource?: string; qrText?:string;status?:string };
        const asset = assetFromBytes(Buffer.from(rendered.svg, 'utf8'));
        return json({ id, mimeType: 'image/svg+xml', byteLength: asset.bytes.length, ...rendered,
          ...(exportFile ? { path: await exportAsset(asset) } : {}) });
      }
      if (!['image', 'svg', 'prop'].includes(object.type) || !object.src) throw new Error('Object is not an image/SVG');
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
    description: deskTargetDescription+'Add or replace an image/SVG from an absolute local file under TABLETOP_ASSET_ROOT (default /tmp), inline SVG source, or a base64 image data URL; exactly one source is required. Server reads files, never the browser. Max 5MB. For add, asProp:true creates an embedded SVG prop with no anchors, URL or open-in-tab controls; custom SVGs and desk_prop_get sources are both accepted. Omit asProp for normal images/SVGs. For add, supply a unique id and optional geometry/title/url. snap defaults to desk (shared grid settings); exact bypasses the grid for this import without changing its global switch. Read placement.results for actual applied coordinates and grid corrections. For replace, only src changes: ID/type/position/size/title/link are preserved. One shared Undo. Use expectedRevision to prevent conflicts; on uncertain outcome inspect revision before retrying.',
    inputSchema: { ...deskTargetFields,
      id: z.string().min(1).max(100), mode: z.enum(['add', 'replace']).default('add'),
      source: z.union([z.object({ path: z.string().max(4096) }).strict(), z.object({ svg: z.string().max(5_000_000) }).strict(), z.object({ dataUrl: z.string().max(8_000_000) }).strict()]),
      x: z.number().finite().optional(), y: z.number().finite().optional(), width: z.number().finite().min(1).max(100_000).optional(), height: z.number().finite().min(35).max(100_000).optional(),
      asProp: z.boolean().optional(), title: z.string().max(100_000).optional(), url: z.string().max(4096).optional(),
      snap: z.enum(['desk', 'exact']).default('desk'),
      actor: z.string().min(1).max(100).default('agent-01'), expectedRevision: z.number().int().nonnegative().optional(),
    }, annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  }, async ({ deskId, id, mode, source, x, y, width, height, title, url, asProp, snap, actor, expectedRevision }): Promise<CallToolResult> => {
    try {
      const request=forDesk(deskId);
      if (mode === 'replace' && [x, y, width, height, title, url, asProp].some(value => value !== undefined)) throw new Error('Replacement accepts only source; geometry/title/link are preserved');
      const asset = 'path' in source ? await importAssetFile(source.path) : 'svg' in source
        ? assetFromBytes(Buffer.from(source.svg, 'utf8')) : embeddedAsset(source.dataUrl);
      if ('svg' in source && asset.mimeType !== 'image/svg+xml') throw new Error('Expected SVG source');
      if (asProp && (asset.mimeType !== 'image/svg+xml' || url)) throw new Error('Props require SVG and cannot have links');
      if (mode === 'replace') {
        const snapshot = await request({ method: 'list' }) as { revision: number; objects: DeskObject[] };
        const object = snapshot.objects.find(object => object.id === id);
        if (!object || !['image', 'svg', 'prop'].includes(object.type)) throw new Error('Replacement requires an image/SVG object');
        if (object.type === 'prop' && asset.mimeType !== 'image/svg+xml') throw new Error('Prop replacement requires SVG');
        expectedRevision ??= snapshot.revision;
      }
      const operations = mode === 'replace' ? [{ kind: 'update' as const, id, patch: { src: asset.src } }]
        : [{ kind: 'add' as const, object: { id, type: asProp ? 'prop' as const : asset.mimeType === 'image/svg+xml' ? 'svg' as const : 'image' as const,
          src: asset.src, x: x ?? 0, y: y ?? 0, width: width ?? 480, height: height ?? 354, text: title ?? id, ...(url !== undefined ? { url } : {}) } }];
      return json(await request({ method: 'execute', operations, snap, actor, expectedRevision }));
    } catch (error) { return failure(error); }
  });
}
