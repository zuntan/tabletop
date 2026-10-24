import {callTestTool} from './mcp-call';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {openTestDesk} from './desk-browser';

test('port handoff uses save/release/open/load and keeps the MCP process alive', {timeout:30000},async()=>{
  const {page,call,client,close,port,errors}=await openTestDesk('port-handoff');
  const listener=createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');
  const target=(listener.address() as {port:number}).port;await new Promise<void>(r=>listener.close(()=>r()));
  try{
    await call('desk_execute',{operations:[{kind:'add',object:{id:'retained',type:'text',x:10,y:20,text:'机を保持'}}]});
    const rejected=await callTestTool(client, {name:'desk_port_set',arguments:{port:target,confirm:true}});assert.equal(rejected.isError,true);
    assert.equal((await call('desk_connection_info')).port,port);
    const saved=await call('desk_save',{filename:`port-change-${Date.now()}.tabletop`});
    await call('desk_release',{confirm:true});
    const changed=await call('desk_port_set',{port:target,confirm:true});assert.equal(changed.port,target);assert.equal(changed.changed,true);
    const info=await call('desk_connection_info');assert.equal(new URL(info.url).port,String(target));assert.equal(info.network.listening,true);
    const next=await (await page.context().browser()!.newContext()).newPage();await next.goto(`${info.url}#token=port-handoff-012345678901234567890123456789&port=${target}`);await next.waitForFunction(()=>document.querySelector('#connection')?.textContent==='MCP接続済み',undefined,{timeout:5000});
    const deskId=await next.locator('#desk-id').textContent();
    const current=await call('desk_summary',{deskId});assert.equal(current.count,0);
    await call('desk_load',{deskId,confirm:true,filename:saved.filename,expectedSessionId:current.sessionId,expectedRevision:current.revision});
    assert.equal((await call('desk_get',{deskId,id:'retained'})).text,'机を保持');
    assert.equal((await call('desk_connection_info')).port,target);assert.deepEqual(errors,[]);
  }finally{await close();}
});
