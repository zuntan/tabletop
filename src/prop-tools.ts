import { readFile } from 'node:fs/promises';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { propPresets } from './prop-presets.js';
export function registerPropTools(mcp: McpServer) {
  const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
  mcp.registerTool('desk_prop_list', {
    description: 'List bundled SVG prop presets (ID, name, description and suggested card dimensions). Props are type:prop: movable/copyable/lockable SVG cards with a white title and background, but no anchors, links or open-in-tab controls. Presets are a material library, not the only permitted prop SVGs. Read source with desk_prop_get, then use desk_asset_import with asProp:true, source:{svg}, title and desired geometry. No browser connection is needed to read this catalog.', inputSchema: {}, annotations,
  }, async () => ({ content: [{ type: 'text' as const, text: JSON.stringify({ presets: propPresets.map(({ filename: _filename, ...preset }) => preset) }) }] }));
  mcp.registerTool('desk_prop_get', {
    description: 'Get bundled prop SVG source by preset ID, with name, description and suggested dimensions. Read-only; does not place it. Use desk_asset_import(asProp:true,source:{svg}) to place a copy. Custom SVGs can use the same import without a preset ID. Placed SVG content is embedded in desk saves and does not sync with the preset.',
    inputSchema: { id: z.string().min(1).max(100) }, annotations,
  }, async ({ id }) => {
    const preset = propPresets.find(item => item.id === id);
    if (!preset) return { isError: true, content: [{ type: 'text' as const, text: 'Unknown prop preset ID' }] };
    const { filename, ...metadata } = preset;
    const svg = await readFile(new URL(`../public/props/${filename}`, import.meta.url), 'utf8');
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ...metadata, svg }) }] };
  });
}
