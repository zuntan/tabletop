import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { stampPatterns, fallbackStamp } from './stamp-values.js';
export function registerStampTools(mcp: McpServer) {
  mcp.registerTool('desk_stamp_patterns', {
    description: 'List stamp designs and their visual meaning. Japanese seals are round, English rubber stamps rectangular, hanamaru a rounded-petal flower with a spiral, smile_ja an original smiling face, well_done_ja large Japanese praise text inside a cherry-blossom petal border. For type:text only, set stamp:{designId,text,angle} via desk_execute; null clears. text is any supplementary string, not a validated date. Human date buttons insert the local date YYYY.MM.DD. SVG negative angles tilt left downward; Sunday -3 through Saturday -9, fixed at press time. Individual stamps retain only these three fields; color and opacity belong to the pattern. Human selection shrinks stamps to the lower right, deselection centers them. No task status or edit lock is changed. Unknown design IDs retain all data and render with the internal untitled fallback, which is not a normal selectable pattern.',
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async () => ({ content: [{ type: 'text' as const, text: JSON.stringify({ patterns: stampPatterns.map(p => ({ ...p, supplementaryText: '下段（任意文字列）' })), fallback: { ...fallbackStamp, internalOnly: true, preservesUnknownId: true } }) }] }));
}
