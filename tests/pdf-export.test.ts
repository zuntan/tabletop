import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Desk,dispatch} from '../src/model';
import {DeskFileStore} from '../src/desk-file-store';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {registerPdfTools} from '../src/pdf-tools';
import {MAX_PDF_EXPORT_BYTES} from '../src/pdf-export';

test('PDF bridge guards revision before invoking the browser and never edits the desk',async()=>{
 const desk=new Desk();let called=0;
 const bridge={pdf:async()=>{called++;return{revision:desk.revision};}};
 assert.throws(()=>dispatch(desk,{method:'pdf_export',expectedRevision:1},undefined,undefined,undefined,undefined,undefined,undefined,bridge),/Revision conflict/);
 assert.equal(called,0);
 assert.throws(()=>dispatch(desk,{method:'pdf_export'}),/compatible browser/);
 const before=desk.snapshot();
 await dispatch(desk,{method:'pdf_export',expectedRevision:0},undefined,undefined,undefined,undefined,undefined,undefined,bridge);
 assert.equal(called,1);assert.equal(desk.revision,0);assert.deepEqual(desk.snapshot(),before);
});

test('PDF MCP writes exclusively, validates PDF data, guards symlinks and explicitly overwrites',async()=>{
 const root=await mkdtemp(join(tmpdir(),'tabletop-pdf-'));
 const server=new McpServer({name:'pdf-test',version:'1'}),client=new Client({name:'test',version:'1'});
 let body=Buffer.from('%PDF-1.4\nexample\n%%EOF\n');const targets:string[]=[];
 registerPdfTools(server,id=>{targets.push(id);return async request=>{
  assert.equal(request.method,'pdf_export');
  return{sessionId:crypto.randomUUID(),revision:7,bounds:{x:-20,y:30,width:400,height:200},raster:{width:400,height:200,scale:1},webCount:0,base64:body.toString('base64')};
 };},new DeskFileStore(root,'.pdf'));
 const [a,b]=InMemoryTransport.createLinkedPair();await server.connect(a);await client.connect(b);
 const call=(args:Record<string,unknown>)=>client.callTool({name:'desk_pdf',arguments:{deskId:'test-desk',path:'scene.pdf',...args}});
 try{
  const saved=await call({});assert.notEqual(saved.isError,true);
  const data=JSON.parse((saved.content as {text:string}[])[0].text);assert.equal(data.path,join(root,'scene.pdf'));assert.equal(data.revision,7);
  assert.deepEqual(await readFile(data.path),body);assert.equal((await call({})).isError,true);
  body=Buffer.from('%PDF-1.4\nchanged\n%%EOF\n');assert.notEqual((await call({overwrite:true})).isError,true);assert.deepEqual(await readFile(data.path),body);
  body=Buffer.from('invalid');assert.equal((await call({overwrite:true})).isError,true);assert.match((await readFile(data.path)).toString(),/changed/);
  assert.equal((await call({path:'bad.tabletop'})).isError,true);assert.equal((await call({path:'nested/file.pdf'})).isError,true);
  if(process.platform!=='win32'){
   await symlink(data.path,join(root,'alias.pdf'));body=Buffer.from('%PDF-1.4\nvalid\n%%EOF\n');
   assert.equal((await call({path:'alias.pdf',overwrite:true})).isError,true);assert.match((await readFile(data.path)).toString(),/changed/);
  }
  assert.ok(targets.every(id=>id==='test-desk'));
  body=Buffer.alloc(MAX_PDF_EXPORT_BYTES,32);body.write('%PDF-1.4');body.write('%%EOF\n',body.length-6);
  assert.notEqual((await call({path:'large.pdf'})).isError,true);
  body=Buffer.alloc(MAX_PDF_EXPORT_BYTES+1);assert.equal((await call({path:'too-large.pdf'})).isError,true);
  await assert.rejects(readFile(join(root,'too-large.pdf')),/ENOENT/);
 }finally{await client.close();await server.close();await rm(root,{recursive:true,force:true});}
});
