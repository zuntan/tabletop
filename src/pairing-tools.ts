import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {pairingSchema} from './pairing-protocol';
import type {DeskConnections,DeskConnection} from './desk-connections';
import {deskTargetFields} from './desk-target';
export function registerPairingTools(mcp:McpServer,desks:DeskConnections,release:(desk:DeskConnection)=>Promise<unknown>){
 const json=(value:unknown)=>({content:[{type:'text' as const,text:JSON.stringify(value)}]});
 const fail=(e:unknown)=>({isError:true,content:[{type:'text' as const,text:e instanceof Error?e.message:String(e)}]});
 mcp.registerTool('desk_release',{description:'Release only the specified deskId with human approval. Preserve its contents first. Other pairings and desks remain connected. Opens acceptance for a new/manual connection; never transfers or reloads content.',inputSchema:{...deskTargetFields,confirm:z.literal(true)}},async({deskId})=>{try{return json(await release(desks.get(deskId)));}catch(e){return fail(e);}});
 mcp.registerTool('desk_pairing_open',{description:'With human approval, open acceptance for one additional new/manual pairing. Existing desks are not released or replaced. Use desk_connection_info for the URL, then desk_connections to identify the new desk. Not for recovery.',inputSchema:{confirm:z.literal(true)}},async()=>{try{return json({...desks.open(),nextAction:{kind:'call-tool',tool:'desk_connection_info'}});}catch(e){return fail(e);}});
 mcp.registerTool('desk_pairing_info',{description:'Get SECRET recovery credentials for the specified deskId only. Retain privately; never write to public docs, logs, desk files or Git. Other desks are unchanged.',inputSchema:deskTargetFields},async({deskId})=>{try{const d=desks.get(deskId);d.activity();return json({deskId,pairing:desks.info(deskId)});}catch(e){return fail(e);}});
 mcp.registerTool('desk_pairing_restore',{description:'Restore this exact privately retained pairing after a server restart. Other registered/connected pairings are unaffected. Does not create a new browser, replay edits or replace a connected endpoint. After recovery read desk_connections; IDs need not be permanently stable.',inputSchema:{pairing:pairingSchema}},async({pairing})=>{try{return json(desks.restore(pairing));}catch(e){return fail(e);}});
}
