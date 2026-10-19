import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerHelpTools } from '../src/help-tools';

test('desk_help returns discoverable plain-text manuals without any browser; rejects unknown topics',async()=>{
  const server=new McpServer({name:'help-test',version:'1'}),client=new Client({name:'reader',version:'1'});
  registerHelpTools(server);const [a,b]=InMemoryTransport.createLinkedPair();
  try{
    await server.connect(a);await client.connect(b);
    const tools=await client.listTools();assert.equal(tools.tools[0].annotations?.readOnlyHint,true);
    const index=await client.callTool({name:'desk_help',arguments:{}});
    assert.notEqual(index.isError,true);assert.match((index.content as any)[0].text,/mermaid-imitation/);
    const guide=await client.callTool({name:'desk_help',arguments:{topic:'mermaid-imitation'}});
    assert.notEqual(guide.isError,true);assert.match((guide.content as any)[0].text,/原本を残し/);
    assert.match((guide.content as any)[0].text,/再現できなかった/);
    const invalid=await client.callTool({name:'desk_help',arguments:{topic:'../../etc/passwd'}});assert.equal(invalid.isError,true);
  }finally{await client.close();await server.close();}
});
