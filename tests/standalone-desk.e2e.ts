import test from 'node:test';
import assert from 'node:assert/strict';
import {Desk} from '../src/model';
import {encodeDeskFile} from '../src/desk-file';
import {openTestDesk} from './desk-browser';

test('standalone desk does not connect or steal active desk and supports offline upload/download',{timeout:30000},async()=>{
 const fixture=await openTestDesk('standalone');const {page,call,close,port,errors}=fixture;
 try{
  await call('desk_execute',{operations:[{kind:'add',object:{id:'active',type:'text',text:'AI desk'}}]});const original=await call('desk_state');
  const context=await page.context().browser()!.newContext();const second=await context.newPage();const sockets:string[]=[];second.on('websocket',socket=>sockets.push(socket.url()));
  await second.goto(`http://127.0.0.1:${port}/?connect=off#token=should-not-be-used&port=${port}`);
  await second.getByText('AI未接続（単独の机）',{exact:true}).waitFor();assert.equal(sockets.length,0);assert.equal(new URL(second.url()).hash,'');
  const local=new Desk();local.execute({operations:[{kind:'add',object:{id:'local',type:'text',text:'Human only'}}]});
  await second.locator('#desk-file').setInputFiles({name:'local.tabletop',mimeType:'application/zip',buffer:Buffer.from(await encodeDeskFile(local))});await second.locator('[data-dialog-choice="confirm"]').click();await second.locator('[data-id="local"]').first().waitFor();
  const download=second.waitForEvent('download');await second.locator('#file-menu').click();await second.locator('#download-desk').click();await download;
  assert.deepEqual(await call('desk_state'),original);assert.equal(sockets.length,0);assert.deepEqual(errors,[]);await context.close();
 }finally{await close();}
});
