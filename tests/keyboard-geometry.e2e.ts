import test from 'node:test';
import assert from 'node:assert/strict';
import {openTestDesk} from './desk-browser';
test('keyboard geometry, repeat Undo and text input isolation',{timeout:30000},async()=>{
 const d=await openTestDesk('keyboard-geometry');const {page,call}=d;
 try{
  await call('desk_execute',{operations:[{kind:'add',object:{id:'a',type:'text',x:0,y:0,width:48,height:48,text:'test'}},{kind:'add',object:{id:'untouched',type:'rect',x:200,y:200}}]});
  await call('desk_select',{ids:['a']});await page.locator('#canvas').focus();
  await page.evaluate(()=>{(window as any).untouchedNode=document.querySelector('#objects [data-id="untouched"]');});
  await page.keyboard.down('ArrowRight');await page.keyboard.down('ArrowRight');
  assert.equal(await page.evaluate(()=>(window as any).untouchedNode===document.querySelector('#objects [data-id="untouched"]')),true);
  await page.keyboard.up('ArrowRight');
  assert.equal(await page.evaluate(()=>(window as any).untouchedNode===document.querySelector('#objects [data-id="untouched"]')),true);
  assert.equal((await call('desk_get',{id:'a'})).x,48);
  await page.keyboard.press('Control+z');assert.equal((await call('desk_get',{id:'a'})).x,0);
  await page.keyboard.press('Shift+ArrowLeft');await page.keyboard.press('Shift+ArrowLeft');assert.equal((await call('desk_get',{id:'a'})).width,24);
  await page.keyboard.press('Alt+Shift+ArrowLeft');assert.equal((await call('desk_get',{id:'a'})).width,23);
  await page.locator('[data-add="text"]').click();await page.locator('[data-inline-text]').fill('typing');await page.keyboard.press('ArrowLeft');await page.keyboard.press('Shift+ArrowRight');
  assert.equal((await call('desk_get',{id:'a'})).width,23);
  await page.keyboard.press('Escape');assert.deepEqual(d.errors,[]);
 }finally{await d.close();}
});
