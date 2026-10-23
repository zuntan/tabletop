import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openTestDesk} from './desk-browser';
import {Desk} from '../src/model';
import {encodeDeskFile,decodeDeskFile} from '../src/desk-file';

test('upload resets normal destination, new-target overwrite asks, and cancellation preserves desk',{timeout:45000},async()=>{
 const root=await mkdtemp(join(tmpdir(),'tabletop-file-guards-'));const fixture=await openTestDesk('file-guards');const {page,call,close,errors}=fixture;
 const choose=async(id:string)=>{await page.locator('#file-menu').click();await page.locator(id).click();};
 const path=join(root,'existing.tabletop');
 try{
  await call('desk_execute',{operations:[{kind:'add',object:{id:'original',type:'text',text:'Original'}}]});
  await call('desk_save',{path});
  const blank=new Desk();blank.execute({operations:[{kind:'add',object:{id:'uploaded',type:'text',text:'Uploaded'}}]});
  await page.locator('#desk-file').setInputFiles({name:'uploaded.tabletop',mimeType:'application/zip',buffer:Buffer.from(await encodeDeskFile(blank))});await page.locator('[data-dialog-choice="confirm"]').click();await page.waitForFunction(()=>document.querySelector('#message')?.textContent==='読込完了');
  await choose('#save-desk');assert.equal(await page.getByRole('textbox',{name:'机ファイルのパス',exact:true}).inputValue(),'uploaded.tabletop');
  await page.getByRole('textbox',{name:'机ファイルのパス',exact:true}).fill(path);await page.locator('[data-dialog-choice="accept"]').click();await page.locator('[data-dialog-choice="cancel"]').click();
  assert.equal((await decodeDeskFile(await readFile(path))).objects[0].id,'original');assert.equal((await call('desk_get',{id:'uploaded'})).text,'Uploaded');
  await choose('#save-desk');await page.getByRole('textbox',{name:'机ファイルのパス',exact:true}).fill(path);await page.locator('[data-dialog-choice="accept"]').click();await page.locator('[data-dialog-choice="confirm"]').click();await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.startsWith('保存完了'));
  assert.equal((await decodeDeskFile(await readFile(path))).objects[0].id,'uploaded');
  // Offline export does not touch the ordinary destination or history.
  const history=await page.evaluate(()=>localStorage.getItem('tabletop.files.recent.v1'));
  const downloading=page.waitForEvent('download');await choose('#download-desk');await downloading;assert.equal(await page.evaluate(()=>localStorage.getItem('tabletop.files.recent.v1')),history);
  await choose('#save-desk');await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.startsWith('保存完了'));assert.equal(await page.locator('#confirm-dialog').count(),0);
  assert.deepEqual(errors,[]);
 }finally{await close();await rm(root,{recursive:true,force:true});}
});

test('human edit during server LOAD aborts replacement and never records failed reference',{timeout:45000},async()=>{
 const root=await mkdtemp(join(tmpdir(),'tabletop-load-race-'));const path=join(root,'other.tabletop');
 // Delay file reads in this isolated server, exposing a real asynchronous replacement race.
 const prelude=`import fs from 'node:fs/promises';import {syncBuiltinESMExports} from 'node:module';const original=fs.open;fs.open=async(...args)=>{if(String(args[0]).endsWith('other.tabletop')&&typeof args[1]==='number')await new Promise(r=>setTimeout(r,1600));return original(...args);};syncBuiltinESMExports();`;
 const fixture=await openTestDesk('file-race',undefined,prelude);const {page,call,close,errors}=fixture;
 try{
  await call('desk_execute',{operations:[{kind:'add',object:{id:'original',type:'text',text:'Original'}}]});await call('desk_save',{path});
  await page.locator('#file-menu').click();await page.locator('#load-desk').click();await page.getByRole('textbox',{name:'机ファイルのパス',exact:true}).fill(path);await page.locator('[data-dialog-choice="accept"]').click();await page.locator('[data-dialog-choice="confirm"]').click();
  // UI editing is allowed during I/O; the load must notice its revision has changed.
  await page.locator('[data-add="text"]').click();await page.locator('.inline-editor textarea').fill('Concurrent human edit');await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.includes('読込中に机が変更'));assert.equal((await call('desk_summary')).count,2);
  assert.deepEqual(errors,[]);
 }finally{await close();await rm(root,{recursive:true,force:true});}
});
