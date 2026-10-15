import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { pairingSchema } from './pairing-protocol.js';
import type { PairingGate } from './pairing-server.js';

export function registerPairingTools(mcp: McpServer, gate: PairingGate) {
  const json = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value) }] });
  mcp.registerTool('desk_pairing_open', {
    description: 'Explicitly allow NEW or manual replacement pairing before presenting the connection URL. Requires user approval and confirm:true. Refuses while a desk is connected. Invalidates the previous pairing; never use this to recover an existing paired desk. Keep the current browser content; never reload it. For recovery use desk_pairing_restore instead.',
    inputSchema: { confirm: z.literal(true) }, annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  }, async () => { try { return json(gate.open()); } catch (error) { return { ...json({ error: (error as Error).message }), isError: true }; } });
  mcp.registerTool('desk_pairing_info', {
    description: 'Get the current pairing recovery credentials through MCP only. Contains SECRET token and secret: retain the full record in private continuation/handoff context after initial pairing. Never put it in public docs, repositories, normal logs or desk files. It is not the configured TABLETOP_TOKEN. Null means no pairing exists in this server process. After restart restore your previously retained record; do NOT open a new pairing or guess credentials. If lost, ask the human to save or manually reconnect the existing tab without reload.',
    inputSchema: {}, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async () => json({ pairing: gate.info() }));
  mcp.registerTool('desk_pairing_restore', {
    description: 'Arm recovery after MCP server restart using the exact private pairing record retained from desk_pairing_info. Fixed and generated bootstrap tokens follow the same pairing rules. No browser automation or token file is needed. Refuses an active desk or a different armed pairing; never automatically replace one. Wait a few seconds, then read session/revision/current content before editing. No mutation replay. If credentials were lost, use human-approved manual pairing instead. This record is secret; do not publish it.',
    inputSchema: { pairing: pairingSchema }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, async ({ pairing }) => { try { return json(gate.restore(pairing)); } catch (error) { return { ...json({ error: (error as Error).message }), isError: true }; } });
}
