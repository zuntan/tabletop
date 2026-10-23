import { DeskFileService, fileSnapshotSchema } from './desk-file-service';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Desk, type Request } from './model';
import { encodeDeskFile, decodeDeskFile } from './desk-file';
import { DeskFileStore, validateDeskFilename } from './desk-file-store';
import { checkDeskBridgeSize } from './desk-file-protocol';

const name = z.string().refine(value => { try { validateDeskFilename(value); return true; } catch { return false; } }, 'Expected a simple .tabletop filename, not a path');
const snapshotSchema=fileSnapshotSchema;
export function registerDeskFileTools(mcp: McpServer, request: (input: Request) => Promise<unknown>, store = new DeskFileStore()) {
  const service=new DeskFileService(store);
  const reference=z.string().min(1).max(4096);
  const result = (value: unknown): CallToolResult => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
  const failure = (error: unknown): CallToolResult => ({ isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }] });
  mcp.registerTool('desk_save', {
    description: 'Save the connected desk, including embedded images, to a server-local .tabletop ZIP. Use path for an absolute server-local .tabletop path (or a basename under the save root). overwrite:true explicitly allows replacing that file atomically. Otherwise a new file is required. Legacy filename is a simple basename under TABLETOP_SAVE_ROOT (default ~/.tabletop/saves), never an arbitrary path. Legacy filename never overwrites. Returns saved session/revision, formatVersion and path. browserSavedState reports updated/unchanged/unavailable for the unsaved-warning baseline; a failed/stale notification does not undo file-save success and must not trigger automatic replay. UI and MCP share format/version and validators. Snapshot is taken at request time; later edits require another save. Max MCP transfer 20 MB JSON, archive 50 MiB. Requires the new browser UI; do not refresh an unsaved old tab. No network fetch or automatic retry.',
    inputSchema: { filename: name.optional(), path:reference.optional(), overwrite:z.boolean().default(false) },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  }, async ({ filename, path:referencePath, overwrite }) => {
    try {
      if(!!filename===!!referencePath)throw new Error('Specify exactly one of filename or path');
      if(filename&&overwrite)throw new Error('Use path for explicit overwrite');
      const snapshot = snapshotSchema.parse(await request({ method: 'file_snapshot',includeGeneration:true }));
      const validator = new Desk(); validator.replaceDocument({ objects: snapshot.objects, settings: snapshot.settings });
      let path:string,byteLength:number;
      if(referencePath){const saved=await service.save(referencePath,snapshot,overwrite);path=saved.path;byteLength=saved.bytes;}
      else{const bytes=await encodeDeskFile(validator);path=await store.save(filename!,bytes);byteLength=bytes.length;}
      // The file is already safely written. A lost/old browser must not turn success into a retryable save failure.
      let browserSavedState:'updated'|'unchanged'|'unavailable'='unavailable';
      try{
        const reply=await request({method:'file_saved',expectedSessionId:snapshot.sessionId,expectedRevision:snapshot.revision,expectedGeneration:snapshot.generation,filePath:path}) as {marked?:boolean};
        browserSavedState=reply.marked?'updated':'unchanged';
      }catch{/* Save succeeded; leave the browser's unsaved warning conservative. */}
      return result({ filename, path, sessionId: snapshot.sessionId, revision: snapshot.revision, count: snapshot.objects.length, formatVersion: 1, bytes: byteLength, browserSavedState });
    } catch (error) { return failure(error); }
  });
  mcp.registerTool('desk_load', {
    description: 'Replace the connected desk from a server-local .tabletop file. Specify path (absolute or a basename under TABLETOP_SAVE_ROOT), or legacy filename (root basename only), never both. Obtain explicit user approval for replacement and preferably save the current desk first, then set confirm:true. Required expectedSessionId and expectedRevision must match the live desk at the atomic commit. Validate the whole archive before applying; missing images become placeholders. One shared Undo restores the previous desk, clears selection/pointing and fits all. UI/MCP share format/version; unknown versions are rejected. Never fetches external images during parsing. Rendering can contact image/iframe URLs. On disconnect/timeout outcome may be unknown: inspect state before retrying; no automatic replay. Requires new browser UI.',
    inputSchema: { filename: name.optional(), path:reference.optional(), confirm: z.literal(true), expectedSessionId: z.string().uuid(), expectedRevision: z.number().int().nonnegative(), actor: z.string().min(1).max(100).default('agent-01') },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  }, async ({ filename, path:referencePath, confirm, expectedSessionId, expectedRevision, actor }) => {
    try {
      if(!!filename===!!referencePath)throw new Error('Specify exactly one of filename or path');
      const path=referencePath?await store.reference(referencePath):undefined;
      const decoded = await decodeDeskFile(referencePath?await store.readReference(referencePath):await store.load(filename!));
      const payload = { method: 'load_document' as const, document: { objects: decoded.objects, settings: decoded.settings }, confirm, expectedSessionId, expectedRevision, actor, filePath:path??await store.reference(filename!) };
      checkDeskBridgeSize(payload);
      const summary = await request(payload);
      return result({ ...summary as Record<string, unknown>, filename, path:payload.filePath, formatVersion: 1, missingAssets: decoded.warnings });
    } catch (error) { return failure(error); }
  });
}
