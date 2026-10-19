import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { observeBrowserLauncher, registerBrowserTools } from '../src/browser-tools';

test('browser launcher requires listening and explicit pairing, never exposes launch secrets or retries',async()=>{
  const server=new McpServer({name:'browser-test',version:'1'}), client=new Client({name:'reader',version:'1'});
  const state={url:'http://127.0.0.1:4317/#token=private-test-token',listening:true,accepting:false,connected:false};
  const launched:string[]=[];let fail=false;
  registerBrowserTools(server,()=>state,async url=>{launched.push(url);if(fail)throw new Error(url);});
  const [a,b]=InMemoryTransport.createLinkedPair();
  try{
    await server.connect(a);await client.connect(b);
    const call=()=>client.callTool({name:'desk_browser_open',arguments:{}});
    assert.equal((await call()).isError,true);assert.equal(launched.length,0);
    state.accepting=true;
    assert.notEqual((await call()).isError,true);assert.equal(launched[0],state.url);
    assert.notEqual((await call()).isError,true);assert.equal(launched.length,2);
    state.connected=true;assert.equal((await call()).isError,true);assert.equal(launched.length,2);
    state.connected=false;state.listening=false;assert.equal((await call()).isError,true);assert.equal(launched.length,2);
    state.listening=true;fail=true;const error=await call();assert.equal(error.isError,true);
    assert.equal(launched.length,3);assert.doesNotMatch(JSON.stringify(error),/private-test-token/);
    assert.equal(state.accepting,true);
  }finally{await client.close();await server.close();}
});

 test('launcher reports early failure but does not wait for an open browser to close',async()=>{
  const child=()=>Object.assign(new EventEmitter(),{exitCode:null,signalCode:null}) as unknown as ChildProcess;
  const failed=child(), failure=observeBrowserLauncher(failed,100);
  failed.emit('exit',1);await assert.rejects(failure,/launcher failed/);
  const done=child(), success=observeBrowserLauncher(done,100);done.emit('exit',0);await success;
  const running=child();await observeBrowserLauncher(running,5);assert.equal(running.listenerCount('exit'),0);
 });
