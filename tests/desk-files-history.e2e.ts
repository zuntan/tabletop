import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openTestDesk} from './desk-browser';
import {decodeDeskFile} from '../src/desk-file';

test('normal SAVE/LOAD, overwrite, links, history and offline download remain distinct',{timeout:60000},async()=>{
 const root=await mkdtemp(join(tmpdir(),'tabletop-file-ui-'));const old=process.env.TABLETOP_SAVE_ROOT;process.env.TABLETOP_SAVE_ROOT=root;
 const fixture=await openTestDesk('file-history');if(old===undefined)delete process.env.TABLETOP_SAVE_ROOT;else process.env.TABLETOP_SAVE_ROOT=old;
 const {page,call,close,errors}=fixture;const path=join(root,'first.tabletop');
 const choose=async(id:string)=>{await page.locator('#file-menu').click();await page.locator(id).click();};
 const enterPath=async(path:string)=>{await page.getByRole('textbox',{name:'机ファイルのパス',exact:true}).fill(path);await page.locator('[data-dialog-choice="accept"]').click();};
 const saved=()=>page.waitForFunction(()=>document.querySelector('#message')?.textContent?.startsWith('保存完了'));
 try{
  await call('desk_execute',{operations:[{kind:'add',object:{id:'first',type:'text',text:'first note'}}]});
  await choose('#save-desk');await enterPath(path);await saved();assert.equal((await decodeDeskFile(await readFile(path))).objects[0].text,'first note');
  await call('desk_execute',{operations:[{kind:'update',id:'first',patch:{text:'changed'}}]});
  await choose('#save-desk');await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.startsWith('保存完了'));
  await page.waitForTimeout(100);assert.equal((await decodeDeskFile(await readFile(path))).objects[0].text,'changed');
  await choose('#add-desk-link');await enterPath(path);await page.locator('.inline-editor').waitFor();await page.keyboard.press('Enter');
  const state=await call('desk_state');const link=state.objects.find((o:any)=>o.deskPath===path);assert.ok(link);assert.equal(link.type,'link');
  await page.locator(`[data-open-desk="${link.id}"]`).click();await page.locator('[data-dialog-choice="cancel"]').click();assert.equal((await call('desk_summary')).count,2);
  await page.locator(`[data-open-desk="${link.id}"]`).click();await page.locator('[data-dialog-choice="discard"]').click();await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.startsWith('読込完了：'));assert.equal((await call('desk_summary')).count,1);
  await choose('#load-desk');await enterPath(join(root,'missing.tabletop'));await page.locator('[data-dialog-choice="confirm"]').click();await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.includes('読込失敗'));assert.equal((await call('desk_summary')).count,1);
  await choose('#recent-desks');assert.equal(await page.locator('#confirm-dialog [data-dialog-choice="0"]').count(),1);await page.locator('[data-dialog-choice="0"]').click();await page.locator('[data-dialog-choice="cancel"]').click();
  const download=page.waitForEvent('download');await choose('#download-desk');await download;
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('tabletop.files.recent.v1')??'[]').length),1);
  await choose('#recent-desks');await page.locator('[data-dialog-choice="0"]').click();await page.locator('[data-dialog-choice="remove"]').click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('tabletop.files.recent.v1')??'[]').length),0);
  await mkdir('tmp/file-history',{recursive:true});await page.locator('#file-menu').click();await page.screenshot({path:'tmp/file-history/menu.png'});
  assert.deepEqual(errors,[]);
 }finally{await close();await rm(root,{recursive:true,force:true});}
});
