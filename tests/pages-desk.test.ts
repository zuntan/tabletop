import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {Desk} from '../src/model';
import {encodeDeskFile,MAX_DESK_FILE_BYTES} from '../src/desk-file';
import {pagesFileRequest} from '../src/pages-desk';
test('static desk reads resolve URLs, reuse archive validation and reject errors and oversized responses',async()=>{
 const desk=new Desk();desk.execute({operations:[{kind:'desk_rename',name:'Static guide'},{kind:'add',object:{id:'note',type:'text',text:'hello'}}]});const bytes=await encodeDeskFile(desk);
 const server=createServer((req,res)=>{if(req.url==='/guide.tabletop'){res.writeHead(200);res.end(bytes);}else if(req.url==='/large'){res.writeHead(200,{'Content-Length':String(MAX_DESK_FILE_BYTES+1)});res.flushHeaders();}else{res.writeHead(404).end();}});
 server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/`;
 try{
  const loaded=await pagesFileRequest({action:'load',path:'guide.tabletop'},base);assert.equal(loaded.path,base+'guide.tabletop');assert.equal(loaded.document.settings.name,'Static guide');assert.equal(loaded.document.objects[0].text,'hello');assert.deepEqual(loaded.missingAssets,[]);
  await assert.rejects(pagesFileRequest({action:'load',path:'missing.tabletop'},base),/HTTP 404/);
  await assert.rejects(pagesFileRequest({action:'load',path:'large'},base),/50MiB/);
  await assert.rejects(pagesFileRequest({action:'load',path:'file:///tmp/a.tabletop'},base),/HTTP/);
  await assert.rejects(pagesFileRequest({action:'save',path:'guide.tabletop'},base));
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
