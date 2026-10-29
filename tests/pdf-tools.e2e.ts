import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openTestDesk} from './desk-browser';

test('AI PDF matches human PDF, ignores camera and leaves selection/document/unsaved state intact',{timeout:60000},async()=>{
 const root=await mkdtemp(join(tmpdir(),'tabletop-pdf-browser-'));
 const desk=await openTestDesk('pdf-tools',`window.__pdfBlob=null;const original=URL.createObjectURL;URL.createObjectURL=function(blob){if(blob.type==='application/pdf')window.__pdfBlob=blob;return original.call(this,blob);};`);
 try{
  const {page,call,client}=desk;
  await call('desk_execute',{operations:[{kind:'add',object:{id:'note',type:'text',x:-500,y:-100,width:600,height:350,text:'## PDFを持ち出す\n\n**同じ見た目で。**',fontSize:36,fill:'#fff7ed',fillOpacity:1,stamp:{designId:'done_ja',text:'',angle:-6}}},{kind:'add',object:{id:'far',type:'ellipse',x:2000,y:1200,width:400,height:300,text:'画面外',fill:'#a7f3d0',fillOpacity:1}}]});
  await call('desk_select',{ids:['note']});await call('desk_point',{ids:['far']});await call('desk_camera_move',{zoom:.4,durationMs:0});
  const before=await call('desk_state'),pages=page.context().pages().length;
  const first=await call('desk_pdf',{path:join(root,'first.pdf'),expectedRevision:before.revision});
  const bytes=await readFile(first.path);assert.equal(first.revision,before.revision);assert.equal(first.bytes,bytes.length);assert.match(bytes.toString('latin1'),/\/Count 1/);
  assert.equal(page.context().pages().length,pages);assert.deepEqual(await call('desk_state'),before);
  const deskId=await page.locator('#desk-id').textContent();
  const conflict=await client.callTool({name:'desk_pdf',arguments:{deskId,path:join(root,'conflict.pdf'),expectedRevision:0}});assert.equal(conflict.isError,true);
  const exists=await client.callTool({name:'desk_pdf',arguments:{deskId,path:first.path}});assert.equal(exists.isError,true);assert.deepEqual(await readFile(first.path),bytes);
  await call('desk_camera_move',{center:{x:1800,y:1000},zoom:1.3,durationMs:0});
  const second=await call('desk_pdf',{path:join(root,'second.pdf')});assert.deepEqual(await readFile(second.path),bytes);
  await page.locator('#file-menu').click();const popupPromise=page.waitForEvent('popup');await page.locator('#open-desk-pdf').click();const popup=await popupPromise;
  await page.waitForFunction(()=>Boolean((window as any).__pdfBlob));
  const human=await page.evaluate(async()=>Array.from(new Uint8Array(await (window as any).__pdfBlob.arrayBuffer())));assert.deepEqual(Buffer.from(human),bytes);await popup.close();
  await page.locator('#thinking-mode').click();assert.notEqual((await call('desk_pdf',{path:join(root,'alone.pdf')})).bytes,0);
  assert.deepEqual(desk.errors,[]);
 }finally{await desk.close();await rm(root,{recursive:true,force:true});}
});
