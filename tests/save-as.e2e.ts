import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {decodeDeskFile} from '../src/desk-file';
import {openTestDesk} from './desk-browser';

test('SAVE AS keeps the original, switches only after success, and handles cancel/conflict/failure safely',{timeout:30_000},async()=>{
 const root=await mkdtemp(join(tmpdir(),'tabletop-save-as-'));const fixture=await openTestDesk('save-as');const{page,call,close,errors}=fixture;
 const a=join(root,'a.tabletop'),b=join(root,'b.tabletop');
 const choose=async(id:string)=>{await page.locator('#file-menu').click();await page.locator(id).click();};
 const enter=async(path:string)=>{await page.getByRole('textbox',{name:'机ファイルのパス',exact:true}).fill(path);await page.locator('[data-dialog-choice="accept"]').click();};
 const saved=async(path:string)=>{await page.waitForFunction(path=>document.querySelector('#message')?.textContent===`保存完了：${path}`,path);};
 const text=async(path:string)=>(await decodeDeskFile(await readFile(path))).objects[0].text;
 try{
  await call('desk_execute',{operations:[{kind:'add',object:{id:'note',type:'text',text:'original'}}]});await call('desk_save',{path:a});
  await choose('#save-desk-as');assert.equal(await page.getByRole('textbox',{name:'机ファイルのパス',exact:true}).inputValue(),a);await page.locator('[data-dialog-choice="cancel"]').click();
  await call('desk_execute',{operations:[{kind:'update',id:'note',patch:{text:'new copy'}}]});
  await choose('#save-desk-as');await enter(b);await saved(b);assert.equal(await text(a),'original');assert.equal(await text(b),'new copy');
  await call('desk_execute',{operations:[{kind:'update',id:'note',patch:{text:'save follows B'}}]});
  await choose('#save-desk');await saved(b);assert.equal(await page.locator('#confirm-dialog').count(),0);assert.equal(await text(b),'save follows B');assert.equal(await text(a),'original');
  // An existing AS target asks before overwrite. Cancel leaves B as the normal target.
  await choose('#save-desk-as');await enter(a);await page.locator('[data-dialog-choice="cancel"]').click();
  await page.locator('#file-menu').click();assert.equal(await page.locator('#save-desk').getAttribute('title'),`保存先：${b}`);await page.keyboard.press('Escape');
  await choose('#save-desk-as');await enter(join(root,'missing','broken.tabletop'));await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.startsWith('保存失敗'));
  await page.locator('#file-menu').click();assert.equal(await page.locator('#save-desk').getAttribute('title'),`保存先：${b}`);await page.keyboard.press('Escape');
  await choose('#save-desk-as');await enter(a);await page.locator('[data-dialog-choice="confirm"]').click();await saved(a);assert.equal(await text(a),'save follows B');
  assert.deepEqual(errors,[]);
 }finally{await close();await rm(root,{recursive:true,force:true});}
});
