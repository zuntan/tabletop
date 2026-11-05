import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,rm} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {openTestDesk} from './desk-browser';
import {decodeDeskFile} from '../src/desk-file';
import type {Page} from 'playwright';

test('two tabs keep their UI languages independent and round-trip an existing Japanese desk',{timeout:60000},async()=>{
 const name='language-multiple';
 const t=await openTestDesk(name);
 const other=await t.page.context().browser()!.newPage({locale:'en-US'});
 const paths=[`/tmp/tabletop-ja-roundtrip-${randomUUID()}.tabletop`,`/tmp/tabletop-en-roundtrip-${randomUUID()}.tabletop`];
 const raw=async(tool:string,args:Record<string,unknown>={})=>{
  const result=await t.client.callTool({name:tool,arguments:args});
  assert.notEqual(result.isError,true,JSON.stringify(result));
  return JSON.parse((result.content as {text:string}[])[0].text);
 };
 const language=async(page:Page,value:string)=>{
  await page.locator('#desk-menu').click();
  await page.locator('#desk-menu-panel > .desk-menu-item').nth(1).click();
  await page.locator('#ui-language').selectOption(value);
  await page.waitForFunction(value=>document.documentElement.lang===value,value);
  await page.keyboard.press('Escape');
 };
 try{
  const a=await t.page.locator('#desk-id').textContent();
  await t.call('desk_execute',{operations:[{kind:'add',object:{id:'private-note',type:'text',text:'この机だけ — A'}}]});
  const untouched=await t.call('desk_state');
  await raw('desk_pairing_open',{confirm:true});
  await other.goto(`http://127.0.0.1:${t.port}/#token=${name}-012345678901234567890123456789&port=${t.port}`);
  await other.waitForFunction(()=>document.querySelector('#connection')?.classList.contains('connected'));
  const b=await other.locator('#desk-id').textContent();assert.notEqual(a,b);
  await language(other,'en');
  assert.equal(await t.page.locator('html').getAttribute('lang'),'ja');
  const empty=await raw('desk_summary',{deskId:b});
  await raw('desk_load',{deskId:b,path:process.cwd()+'/docs/tabletop/tabletop-guide.tabletop',expectedSessionId:empty.sessionId,expectedRevision:empty.revision,confirm:true});
  const before=await raw('desk_state',{deskId:b});
  await raw('desk_save',{deskId:b,path:paths[0]});
  await language(other,'ja');await language(other,'en');
  assert.deepEqual(await raw('desk_state',{deskId:b}),before);
  assert.deepEqual(await t.call('desk_state'),untouched);
  assert.equal(await t.page.locator('html').getAttribute('lang'),'ja');
  assert.equal(await other.locator('html').getAttribute('lang'),'en');
  await raw('desk_save',{deskId:b,path:paths[1]});
  const original=await decodeDeskFile(await readFile('docs/tabletop/tabletop-guide.tabletop'));
  for(const path of paths){
   const saved=await decodeDeskFile(await readFile(path));
   assert.deepEqual(saved,original,'UI switching and saving must retain existing Japanese content and artwork');
  }
  const state=await raw('desk_summary',{deskId:b});
  await raw('desk_load',{deskId:b,path:paths[1],expectedSessionId:state.sessionId,expectedRevision:state.revision,confirm:true});
  assert.equal(await other.locator('html').getAttribute('lang'),'en');
  assert.deepEqual((await raw('desk_state',{deskId:b})).objects,before.objects);
  assert.deepEqual(await t.call('desk_state'),untouched);
  assert.deepEqual(t.errors,[]);
 }finally{await other.close();await t.close();await Promise.all(paths.map(path=>rm(path,{force:true})));}
});
