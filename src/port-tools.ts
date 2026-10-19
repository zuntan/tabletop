import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerPortTools(mcp: McpServer, change: (port: number) => Promise<unknown>) {
  mcp.registerTool('desk_port_set', {
    description: 'Change the runtime HTTP/WebSocket listening port without restarting MCP. Requires a human request and confirm:true. For a connected desk: desk_save, approved desk_release, this tool, desk_browser_open, verify connection, then guarded desk_load. Refuses connected or registered pairings and pending connection activity. Keeps LAN intent unchanged; never changes firewall/router/OS policy or TABLETOP_PORT startup configuration. On bind failure rolls back to the old port; inspect desk_connection_info before further action. Old port URLs stop working and existing read-only shares are revoked after an actual change. This tool never saves, loads, opens or closes a browser automatically.',
    inputSchema: { port: z.number().int().min(1).max(65535), confirm: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  }, async ({ port }) => {
    try { return { content: [{ type: 'text' as const, text: JSON.stringify(await change(port)) }] }; }
    catch (error) { return { isError: true, content: [{ type: 'text' as const, text: error instanceof Error ? error.message : 'Port change failed; inspect desk_connection_info.' }] }; }
  });
}
