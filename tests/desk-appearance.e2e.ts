import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openTestDesk} from './desk-browser';
import {plainDeskColors} from '../src/desk-appearance';

test('pale plain choices and title background identify the desk without changing connection or parts',{timeout:35000},async()=>{
 const root=await mkdtemp(join(tmpdir(),'tabletop-colors-'));const {page,call,close,errors}=await openTestDesk('desk-colors');
 try{
  await call('desk_execute',{operations:[{kind:'add',object:{id:'note',type:'text',text:'色を選んで机を見分ける',fill:'#fff7ed',width:500,height:260}}]});const before=await call('desk_state');const marker=await page.locator('#connection').evaluate(el=>({text:el.textContent,color:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor}));
  await page.locator('#desk-menu').click();await page.getByRole('button',{name:'机の見た目…'}).click();
  const wallpaper=page.getByRole('combobox',{name:'壁紙',exact:true});assert.deepEqual((await wallpaper.locator('option').allTextContents()).slice(0,7),['無地',...plainDeskColors.map(p=>p.label),'木目1']);
  for(const plain of plainDeskColors){await wallpaper.selectOption(plain.value);assert.equal(await page.locator('#desk-background').getAttribute('fill'),plain.color);assert.equal(await page.locator('#desk-wallpaper').getAttribute('fill'),'none');assert.equal(await page.locator('#desk-grid').getAttribute('visibility'),'visible');}
  const color=page.getByLabel('タイトル背景色',{exact:true});await color.fill('#dcecf5');await color.dispatchEvent('change');assert.equal(await page.locator('header').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(220, 236, 245)');assert.equal(await page.locator('header').evaluate(el=>getComputedStyle(el).color),'rgb(15, 23, 42)');
  assert.deepEqual(await page.locator('#connection').evaluate(el=>({text:el.textContent,color:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor})),marker);
  assert.deepEqual((await call('desk_state')).objects,before.objects);assert.deepEqual((await call('desk_state')).settings.grid,before.settings.grid);
  await mkdir('tmp/desk-colors',{recursive:true});await page.screenshot({path:'tmp/desk-colors/light.png'});await page.keyboard.press('Escape');
  const path=join(root,'colored.tabletop');await call('desk_save',{path});await call('desk_execute',{operations:[{kind:'background_update',patch:{titleBackground:null,wallpaper:'wood',color:null}}]});
  const summary=await call('desk_summary');await call('desk_load',{path,confirm:true,expectedSessionId:summary.sessionId,expectedRevision:summary.revision});assert.equal(await page.locator('header').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(220, 236, 245)');assert.equal(await page.locator('#desk-background').getAttribute('fill'),plainDeskColors[4].color);
  await call('desk_ui_set',{theme:'dark'});assert.equal(await page.locator('header').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(220, 236, 245)');await page.screenshot({path:'tmp/desk-colors/dark.png'});
  await page.locator('#desk-menu').click();await page.getByRole('button',{name:'机の見た目…'}).click();await page.getByRole('button',{name:'タイトル背景色を標準に戻す'}).click();assert.equal(await page.locator('header').evaluate(el=>el.style.backgroundColor),'');await wallpaper.selectOption('none');assert.equal(await page.locator('#desk-background').getAttribute('fill'),'#f8fafc');assert.deepEqual(errors,[]);
 }finally{await close();await rm(root,{recursive:true,force:true});}
});
