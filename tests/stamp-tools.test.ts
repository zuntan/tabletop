import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {registerStampTools} from '../src/stamp-tools';
import {stampPatterns, fallbackStamp} from '../src/stamp-values';
import descriptions from '../src/stamp-descriptions.json';

test('stamp catalog explains every stable design in English while preserving artwork and response fields', async () => {
  const server=new McpServer({name:'stamp-test',version:'1'}),client=new Client({name:'reader',version:'1'});
  registerStampTools(server);
  const [a,b]=InMemoryTransport.createLinkedPair();
  try {
    await server.connect(a); await client.connect(b);
    const result=await client.callTool({name:'desk_stamp_patterns',arguments:{}});
    assert.notEqual(result.isError,true);
    const catalog=JSON.parse((result.content as any)[0].text);
    assert.deepEqual(Object.keys(descriptions).sort(),stampPatterns.map(p=>p.id).sort());
    assert.equal(catalog.patterns.length,stampPatterns.length);
    for (const [index, pattern] of stampPatterns.entries()) {
      const actual=catalog.patterns[index];
      assert.deepEqual(Object.keys(actual).sort(),[...Object.keys(pattern),'supplementaryText'].sort());
      for (const key of ['id','caption','title','shape','color','opacity'] as const) assert.equal(actual[key],pattern[key]);
      assert.match(actual.style,/[A-Za-z]/);
      assert.equal(typeof actual.supplementaryText,'string');
    }
    assert.match(catalog.patterns.find((p:any)=>p.id==='done_ja').style,/Completed/);
    assert.equal(catalog.patterns.find((p:any)=>p.id==='done_ja').title,'済');
    assert.equal(catalog.fallback.id,fallbackStamp.id);
    assert.equal(catalog.fallback.internalOnly,true);
    assert.equal(catalog.fallback.preservesUnknownId,true);
    const tools=await client.listTools();
    assert.match(tools.tools[0].description!,/not a workflow status update/);
  } finally { await client.close(); await server.close(); }
});
