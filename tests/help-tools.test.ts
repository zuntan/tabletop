import {paletteColors,swatches} from '../src/color-palettes';
import {callTestTool} from './mcp-call';
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
    const index=await callTestTool(client, {name:'desk_help',arguments:{}});
    assert.notEqual(index.isError,true);assert.match((index.content as any)[0].text,/mermaid-imitation/);
    const guide=await callTestTool(client, {name:'desk_help',arguments:{topic:'mermaid-imitation'}});
    assert.notEqual(guide.isError,true);assert.match((guide.content as any)[0].text,/Preserve the original/);
    assert.match((guide.content as any)[0].text,/could not be reproduced/);
    for(const [topic,title] of [['bell-conversation','Bell'],['desk-connections','Opening a desk'],['card-splitting','original'],['rulers','ruler'],['wayfinder','desk_wayfinder_start']] as const){
      const result=await callTestTool(client, {name:'desk_help',arguments:{topic}});
      assert.notEqual(result.isError,true,topic);assert.doesNotMatch((result.content as any)[0].text,/[\u3040-\u30ff\u3400-\u9fff]/,topic);assert.ok((result.content as any)[0].text.includes(title),topic);
    }
    const colors=await callTestTool(client,{name:'desk_help',arguments:{topic:'colors'}});
    assert.notEqual(colors.isError,true);
    const body=(colors.content as any)[0].text;
    assert.match(body,/User color choices/);assert.match(body,/existing desk colors/);
    const palettes=JSON.parse(body.match(/```json\n([\s\S]*?)\n```/)[1]);
    for(const role of ['fill','stroke','text','sticker'] as const){
      assert.deepEqual(palettes.recommended[role],paletteColors(role));
      assert.equal(palettes.recommended[role].length,14);
    }
    assert.deepEqual(palettes.all,swatches);
    assert.equal(palettes.recommended.stroke[0],'#ffffff');assert.equal(palettes.recommended.stroke[7],'#000000');
    assert.match((index.content as any)[0].text,/colors/);
    const invalid=await callTestTool(client, {name:'desk_help',arguments:{topic:'../../etc/passwd'}});assert.equal(invalid.isError,true);
  }finally{await client.close();await server.close();}
});
