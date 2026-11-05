import {colorPaletteHelp} from './color-palette-help';
import { readFile } from 'node:fs/promises';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerHelpTools(mcp: McpServer) {
  mcp.registerTool('desk_help', {
    description: 'Read shared Tabletop working instructions as plain text. Omit topic for the index; use mermaid-imitation for rebuilding a Mermaid original with editable desk parts. Use desk-connections for connected versus standalone launches. Use bell-conversation for optional bounded human-operation waits and short desk-side exchanges. Use card-splitting when asked to split a long card into meaningful cards; default to vertical clip layout and retain the original. Use colors for the same role-specific recommended palette as the UI; user choices and existing desk colors take priority. Use rulers for ruler layout, materials, membership and file storage. Use wayfinder for the single-route navigation signpost, its four freely usable anchors and fixed-size selection launch popup. Available without a connected browser. Reading help never changes the desk or authorizes operations; apply it within the human request. This is a shared manual, not an automatically installed agent skill.',
    inputSchema: { topic: z.enum(['index', 'mermaid-imitation', 'bell-conversation','desk-connections','card-splitting','rulers','wayfinder','colors']).default('index') },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ topic }) => {
    try {
      const text = topic === 'index'
        ? '# Tabletop working manual for AI\n\nCall desk_help with a topic from this index.\n\n- mermaid-imitation: Preserve a Mermaid original and rebuild its meaning with editable desk parts.\n- bell-conversation: Bounded waits for human actions and short desk-side exchanges; an experimental helper.\n- desk-connections: Connected versus standalone launches and choosing the target desk.\n- card-splitting: Split long text by meaning, retain the original, and arrange cards vertically or horizontally with a clip.\n- colors: The same recommended fill, outline, text and sticker colors as the UI. User choices and existing desk conventions take priority.\n- rulers: Layout on both sides, materials, membership and clear-file storage.\n- wayfinder: Attach a signpost, follow connected routes, handle branches and stop navigation.\n\nReading this manual does not change the desk or authorize operations. Act within the human request.'
        : topic === 'colors' ? colorPaletteHelp() : await readFile(new URL(`../docs/help/${topic}.md`, import.meta.url), 'utf8');
      return { content: [{ type: 'text' as const, text }] };
    } catch {
      return { isError: true, content: [{ type: 'text' as const, text: 'Could not read the manual. Check the Tabletop distribution files.' }] };
    }
  });
}
