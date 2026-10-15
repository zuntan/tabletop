import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Desk, type Request } from './model';
import { encodeDeskFile, decodeDeskFile } from './desk-file';
import { DeskFileStore, validateDeskFilename } from './desk-file-store';
import { checkDeskBridgeSize } from './desk-file-protocol';

const name = z.string().refine(value => { try { validateDeskFilename(value); return true; } catch { return false; } }, 'Expected a simple .tabletop filename, not a path');
const snapshotSchema = z.object({ sessionId: z.string().uuid(), revision: z.number().int().nonnegative(), objects: z.array(z.unknown()), settings: z.unknown() }).strict();
export function registerDeskFileTools(mcp: McpServer, request: (input: Request) => Promise<unknown>, store = new DeskFileStore()) {
  const result = (value: unknown): CallToolResult => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
  const failure = (error: unknown): CallToolResult => ({ isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }] });
  mcp.registerTool('desk_save', {
    description: 'Save the connected desk, including embedded images, to a server-local .tabletop ZIP. filename is a simple basename under TABLETOP_SAVE_ROOT (default ~/.tabletop/saves), never an arbitrary path. Existing files are never overwritten. Returns saved session/revision, formatVersion and path. UI and MCP share format/version and validators. Snapshot is taken at request time; later edits require another save. Max MCP transfer 20 MB JSON, archive 50 MiB. Requires the new browser UI; do not refresh an unsaved old tab. No network fetch or automatic retry.',
    inputSchema: { filename: name },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async ({ filename }) => {
    try {
      const snapshot = snapshotSchema.parse(await request({ method: 'file_snapshot' }));
      const validator = new Desk(); validator.replaceDocument({ objects: snapshot.objects, settings: snapshot.settings });
      const bytes = await encodeDeskFile(validator);
      const path = await store.save(filename, bytes);
      return result({ filename, path, sessionId: snapshot.sessionId, revision: snapshot.revision, count: snapshot.objects.length, formatVersion: 1, bytes: bytes.length });
    } catch (error) { return failure(error); }
  });
  mcp.registerTool('desk_load', {
    description: 'Replace the connected desk from a server-local .tabletop file under TABLETOP_SAVE_ROOT. Obtain explicit user approval for replacement and preferably save the current desk first, then set confirm:true. Required expectedSessionId and expectedRevision must match the live desk at the atomic commit. Validate the whole archive before applying; missing images become placeholders. One shared Undo restores the previous desk, clears selection/pointing and fits all. UI/MCP share format/version; unknown versions are rejected. Never fetches external images during parsing. Rendering can contact image/iframe URLs. On disconnect/timeout outcome may be unknown: inspect state before retrying; no automatic replay. Requires new browser UI.',
    inputSchema: { filename: name, confirm: z.literal(true), expectedSessionId: z.string().uuid(), expectedRevision: z.number().int().nonnegative(), actor: z.string().min(1).max(100).default('agent-01') },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  }, async ({ filename, confirm, expectedSessionId, expectedRevision, actor }) => {
    try {
      const decoded = await decodeDeskFile(await store.load(filename));
      const payload = { method: 'load_document' as const, document: { objects: decoded.objects, settings: decoded.settings }, confirm, expectedSessionId, expectedRevision, actor };
      checkDeskBridgeSize(payload);
      const summary = await request(payload);
      return result({ ...summary as Record<string, unknown>, filename, formatVersion: 1, missingAssets: decoded.warnings });
    } catch (error) { return failure(error); }
  });
}
