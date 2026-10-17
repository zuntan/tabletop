import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DeskShareServer, shareOpenSchema } from './share-server';

export function registerShareTools(mcp: McpServer, sharing: DeskShareServer) {
  const result = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data) }] });
  const failure = (error: unknown) => ({ isError: true, content: [{ type: 'text' as const, text: error instanceof Error ? error.message : 'Share operation failed' }] });
  mcp.registerTool('desk_share_open', {
    description: 'After explicit human approval, open a dedicated READ-ONLY loopback listener for the currently connected desk (default port 4320). publicBaseUrl must be the HTTPS origin of a separately configured tunnel that forwards ONLY to this port, never the UI/bridge port. This tool does not start a tunnel or open LAN. Returns an invitation URL /share/{shareId}; shareId is a bearer read credential, separate from pairing and edit tokens. The invitation explains desk_context, desk_get and desk_asset_read with MCP-compatible names and arguments. Exposes current entire desk contents including embedded assets, not history. Reads are live, not a saved snapshot. Only share approved test data first. Sharing ends on close, disconnect, release, browser/session replacement or server restart; never automatically restore it. URL persists in any conversation where it is pasted. Close before changing publicBaseUrl/port or inviting a different desk.',
    inputSchema: shareOpenSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  }, async args => { try { return result(await sharing.open(args)); } catch (error) { return failure(error); } });
  mcp.registerTool('desk_share_close', {
    description: 'After the human requests sharing end, revoke the current read invitation and stop its dedicated listener. Existing fetched copies cannot be recalled. Does not stop the separately managed tunnel or disconnect/edit the local desk. No automatic reopening; a new open creates a new read credential.',
    inputSchema: { confirm: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, async () => { try { return result(await sharing.close()); } catch (error) { return failure(error); } });
}
