import {deskTargetFields,deskTargetDescription} from './desk-target';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DeskShareServer, shareOpenSchema } from './share-server';

export function registerShareTools(mcp: McpServer, forDesk: (deskId:string)=>DeskShareServer) {
  const result = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data) }] });
  const failure = (error: unknown) => ({ isError: true, content: [{ type: 'text' as const, text: error instanceof Error ? error.message : 'Share operation failed' }] });
  mcp.registerTool('desk_share_open', {
    description: deskTargetDescription+'After explicit human approval, open a dedicated READ-ONLY loopback listener for the specified deskId (default port 4320). publicBaseUrl must be the HTTPS origin of a separately configured tunnel that forwards ONLY to this port, never the UI/bridge port. This tool does not start a tunnel or open LAN. Returns an invitation URL /share/{shareId}; shareId is a bearer read credential, separate from pairing and edit tokens. The invitation explains desk_context, desk_get and desk_asset_read with MCP-compatible names and arguments. Exposes current entire desk contents including embedded assets, not history. Reads are live, not a saved snapshot. Only share approved test data first. Sharing ends on close, disconnect, release, browser/session replacement or server restart; never automatically restore it. URL persists in any conversation where it is pasted. Each desk has its own invitation/listener; use distinct ports and dedicated tunnels for simultaneous shares. Close this desk share before changing its origin or port.',
    inputSchema: {...deskTargetFields,...shareOpenSchema.shape},
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  }, async args => { try { const {deskId,...options}=args;return result(await forDesk(deskId).open(options)); } catch (error) { return failure(error); } });
  mcp.registerTool('desk_share_close', {
    description: deskTargetDescription+'After the human requests sharing end, revoke the current read invitation and stop its dedicated listener. Existing fetched copies cannot be recalled. Does not stop the separately managed tunnel or disconnect/edit the local desk. No automatic reopening; a new open creates a new read credential.',
    inputSchema: { ...deskTargetFields, confirm: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, async ({deskId}) => { try { return result(await forDesk(deskId).close()); } catch (error) { return failure(error); } });
}
