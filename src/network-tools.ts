import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerNetworkTools(mcp: McpServer, change: (enabled: boolean) => Promise<unknown>) {
  mcp.registerTool('desk_network_set', {
    description: 'AI-only HTTP LAN trial control. Requires explicit human authorization and confirm:true. enabled:true rebinds the SAME single port from 127.0.0.1 to 0.0.0.0; only current private IPv4 interface addresses are accepted as LAN Hosts/Origins. HTTP is NOT encrypted: pairing cannot prevent network snooping or tampering. Enabling preserves the current local paired desk and never releases, saves, copies, loads or migrates content. For a device handoff explicitly desk_release the old desk, then present desk_connection_info. If the original desk has content and its disposition is unspecified, consider asking once whether to transfer the contents; skip for an empty desk or explicit move/connect-only instructions. This is guidance, not a mandatory dialog; never transfer automatically. enabled:false returns to loopback and closes remote sockets without deleting pairing or browser content. Every process starts local-only. Retain authorized LAN intent in private continuation context; after an idle process restart restore it with this tool, then desk_pairing_restore using the retained pairing record. Do not restore after authorization is revoked or lost; do not claim availability while the process is stopped. Never open LAN merely to deploy or test.',
    inputSchema: { enabled: z.boolean(), confirm: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  }, async ({ enabled }) => {
    try { return { content: [{ type: 'text' as const, text: JSON.stringify(await change(enabled)) }] }; }
    catch (error) { return { isError: true, content: [{ type: 'text' as const, text: (error as Error).message }] }; }
  });
}
