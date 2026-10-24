import type {Client} from '@modelcontextprotocol/sdk/client/index.js';
const serverTools=new Set(['desk_connections','desk_connection_info','desk_pairing_open','desk_pairing_restore','desk_browser_open','desk_network_set','desk_port_set','desk_help','desk_prop_list','desk_prop_get','desk_stamp_patterns']);
/** Old single-desk fixtures explicitly resolve their only endpoint at the test boundary.
 * The production API never supplies this fallback. Multi-desk tests supply IDs themselves. */
export async function callTestTool(client:Client,params:Parameters<Client['callTool']>[0],schema?:any,options?:any){
 if(!serverTools.has(params.name)&&params.arguments?.deskId===undefined){
  const info=await client.callTool({name:'desk_connection_info',arguments:{}});
  const value=JSON.parse((info.content as {text:string}[])[0].text),registered=value.connections??[],live=registered.filter((d:{connected:boolean})=>d.connected);
  const candidates=live.length?live:registered;
  if(candidates.length>1)throw Error('Single-desk test fixture is ambiguous; specify deskId explicitly');
  params={...params,arguments:{...params.arguments,deskId:candidates[0]?.deskId??'unavailable-test-desk'}};
 }
 return client.callTool(params,schema,options);
}
