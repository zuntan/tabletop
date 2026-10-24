import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {once} from 'node:events';
async function freePort(){const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const port=(server.address() as {port:number}).port;await new Promise<void>(resolve=>server.close(()=>resolve()));return port;}
import {openTestDesk} from './desk-browser';

test('every desk tool requires a target and two live desks keep edits, bells, files and release isolated',{timeout:45_000},async()=>{
 const name='multiple-desks',fixture=await openTestDesk(name),{page,client,port,close}=fixture;
 const other=await page.context().browser()!.newPage();
 const root=await mkdtemp(join(tmpdir(),'multi-desks-'));
 const raw=async(name:string,deskId:string,args:Record<string,unknown>={})=>{
  const result=await client.callTool({name,arguments:{deskId,...args}});
  assert.notEqual(result.isError,true,JSON.stringify(result));return JSON.parse((result.content as {text:string}[])[0].text);
 };
 const global=async(name:string,args:Record<string,unknown>={})=>{const r=await client.callTool({name,arguments:args});assert.notEqual(r.isError,true,JSON.stringify(r));return JSON.parse((r.content as {text:string}[])[0].text);};
 try{
  const a=(await page.locator('#desk-id').textContent())!;
  assert.equal((await client.callTool({name:'desk_summary',arguments:{}})).isError,true);
  assert.equal((await client.callTool({name:'desk_summary',arguments:{deskId:'unknown'}})).isError,true);
  await global('desk_pairing_open',{confirm:true});
  await other.goto(`http://127.0.0.1:${port}/?newDeskName=${encodeURIComponent("無題(2)")}#token=${name}-012345678901234567890123456789&port=${port}`);
  await other.waitForFunction(()=>document.querySelector('#connection')?.textContent==='MCP接続済み');
  const b=(await other.locator('#desk-id').textContent())!;assert.notEqual(a,b);assert.equal(await other.locator('#desk-name').textContent(),'無題(2)');assert.equal(new URL(other.url()).searchParams.has('newDeskName'),false);
  const globalNames=new Set(['desk_connections','desk_connection_info','desk_pairing_open','desk_pairing_restore','desk_browser_open','desk_network_set','desk_port_set','desk_help','desk_prop_list','desk_prop_get','desk_stamp_patterns']);
  for(const tool of (await client.listTools()).tools)assert.equal(tool.inputSchema.required?.includes('deskId')??false,!globalNames.has(tool.name),tool.name);
  await Promise.all([
   raw('desk_execute',a,{operations:[{kind:'desk_rename',name:'元の机'},{kind:'background_update',patch:{titleBackground:'#dbeafe'}},{kind:'add',object:{id:'same',type:'text',text:'A'}}]}),
   raw('desk_execute',b,{operations:[{kind:'desk_rename',name:'新しい机'},{kind:'background_update',patch:{titleBackground:'#fce7f3'}},{kind:'add',object:{id:'same',type:'text',text:'B'}}]}),
  ]);
  for(let i=0;i<3;i++)await Promise.all([raw('desk_execute',a,{operations:[{kind:'update',id:'same',patch:{text:'A'+i}}]}),raw('desk_execute',b,{operations:[{kind:'update',id:'same',patch:{text:'B'+i}}]})]);
  assert.equal((await raw('desk_get',a,{id:'same'})).text,'A2');assert.equal((await raw('desk_get',b,{id:'same'})).text,'B2');
  const list=await global('desk_connections');assert.equal(list.desks.length,2);
  assert.equal(list.desks.find((d:{deskId:string})=>d.deskId===a).name,'元の机');assert.equal(list.desks.find((d:{deskId:string})=>d.deskId===b).background.titleBackground,'#fce7f3');
  await Promise.all([raw('desk_save',a,{path:join(root,'a.tabletop')}),raw('desk_save',b,{path:join(root,'b.tabletop')})]);
  await raw('desk_execute',a,{operations:[{kind:'update',id:'same',patch:{text:'A changed'}}]});
  const beforeLoad=await raw('desk_summary',a);
  await raw('desk_load',a,{path:join(root,'a.tabletop'),confirm:true,expectedSessionId:beforeLoad.sessionId,expectedRevision:beforeLoad.revision});
  assert.equal((await raw('desk_get',a,{id:'same'})).text,'A2');assert.equal((await raw('desk_get',b,{id:'same'})).text,'B2');
  await raw('desk_point',a,{ids:['same']});assert.deepEqual((await raw('desk_selection',b)).aiPointing,[]);
  await page.locator('#desk-bell').click();await other.locator('#desk-bell').click();
  const bells=await Promise.all([raw('desk_bell_wait',a,{timeoutMs:0}),raw('desk_bell_wait',b,{timeoutMs:0})]);assert.ok(bells.every(r=>r.status==='bell'));assert.notEqual(bells[0].epoch,bells[1].epoch);
  await raw('desk_summary',a);assert.equal(await other.locator('#bell-led').getAttribute('data-lit'),'true');
  await global('desk_connections');assert.equal(await other.locator('#bell-led').getAttribute('data-lit'),'true');
  const shares=await Promise.all([raw('desk_share_open',a,{confirm:true,publicBaseUrl:'https://a.example',port:await freePort()}),raw('desk_share_open',b,{confirm:true,publicBaseUrl:'https://b.example',port:await freePort()})]);
  const shareUrl=(share:{url:string;port:number})=>`http://127.0.0.1:${share.port}${new URL(share.url).pathname}/desk_get?id=same`;
  assert.equal((await (await fetch(shareUrl(shares[0]))).json()).text,'A2');assert.equal((await (await fetch(shareUrl(shares[1]))).json()).text,'B2');
  await raw('desk_message',a,{text:'A only',durationMs:0});assert.equal(await other.locator('#desk-toast').isVisible(),false);
  await raw('desk_release',a,{confirm:true});
  assert.equal((await raw('desk_get',b,{id:'same'})).text,'B2');
  assert.equal((await (await fetch(shareUrl(shares[1]))).json()).text,'B2');
  await assert.rejects(fetch(shareUrl(shares[0]))); // Releasing A also stops A's listener.
  const pairing=(await raw('desk_pairing_info',b)).pairing;assert.ok(pairing.secret);
  const waiting=raw('desk_bell_wait',b,{afterSequence:bells[1].sequence,epoch:bells[1].epoch,timeoutMs:10_000});
  await other.close();assert.equal((await waiting).status,'disconnected');
  await global('desk_pairing_restore',{pairing});
  assert.equal((await client.callTool({name:'desk_get',arguments:{deskId:b,id:'same'}})).isError,true);
  assert.ok((await global('desk_connections')).desks.some((d:{deskId:string})=>d.deskId===b));
 }finally{await other.close();await close();await rm(root,{recursive:true,force:true});}
});
