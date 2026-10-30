import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openTestDesk} from './desk-browser';

test('split stationery buttons repeat applied choices, independent of previews and clears',{timeout:45000},async()=>{
 const {page,call,close,errors}=await openTestDesk('stationery-repeat');
 try{
  await call('desk_execute',{operations:[{kind:'add',object:{id:'a',type:'text',x:200,y:200,width:400,height:300,text:'A'}},{kind:'add',object:{id:'b',type:'text',x:700,y:200,width:400,height:300,text:'B'}},{kind:'add',object:{id:'line',type:'line',x:0,y:0,x2:100,y2:0}}]});
  assert.equal(await page.locator('#stamp-open').isDisabled(),true);
  await call('desk_select',{ids:['a']});
  await page.evaluate(()=>{(window as any).__stationeryBody=document.querySelector('[data-id="a"]');(window as any).__stationeryOther=document.querySelector('[data-id="b"]');});
  await page.locator('#stamp-open').click();assert.equal(await page.locator('[data-id="a"] [data-stamp="done_ja"]').count(),1);assert.equal((await call('desk_get',{id:'a'})).stamp.designId,'done_ja');
  assert.equal(await page.locator('[data-id="a"] [data-stamp]').getAttribute('data-compact'),'false');
  assert.ok(await page.evaluate(()=>document.querySelector('[data-id="a"]')===(window as any).__stationeryBody&&document.querySelector('[data-id="b"]')===(window as any).__stationeryOther));
  assert.deepEqual((await call('desk_state')).selection,['a']);
  await page.waitForFunction(()=>document.querySelector('[data-id="a"] [data-stamp]')?.getAttribute('data-compact')==='true');
  await page.locator('#sticker-open').click();assert.ok(await page.evaluate(()=>document.querySelector('[data-id="a"]')===(window as any).__stationeryBody));let a=await call('desk_get',{id:'a'});assert.deepEqual(a.stickers.items,[{shape:'circle',color:'#ef4444'}]);
  const rev=(await call('desk_summary')).revision;
  await page.locator('#stamp-menu').click();assert.equal((await call('desk_summary')).revision,rev);
  await page.locator('#stamp-dated').check();await page.locator('[data-stamp-design="pass_ja"]').click();assert.equal(await page.locator('[data-id="a"] [data-stamp="pass_ja"]').count(),1);
  const stamp=(await call('desk_get',{id:'a'})).stamp;assert.match(stamp.text,/^\d{4}\.\d{2}\.\d{2}$/);
  await page.locator('[data-stamp-design="wanted_en"]').hover();await page.locator('#stamp-menu').click();
  await call('desk_select',{ids:['b']});await page.locator('#stamp-open').click();assert.equal(await page.locator('[data-id="b"] [data-stamp="pass_ja"]').count(),1);assert.deepEqual((await call('desk_get',{id:'b'})).stamp,stamp);
  await page.locator('#sticker-menu').click();
  await page.locator('#sticker-shape-menu-2').click();await page.locator('.sticker-choice-palette:popover-open').getByRole('tab',{name:'シールの型',exact:true}).click();await page.locator('.sticker-shape-palette:popover-open').getByRole('button',{name:'星',exact:true}).click();await page.keyboard.press('Escape');
  await page.locator('#sticker-add-2').click();assert.equal(await page.locator('#sticker-open svg').getAttribute('data-sticker-shape'),'star');assert.equal(await page.locator('#sticker-open svg').getAttribute('fill'),'currentColor');await page.locator('#sticker-clear-2').click();
  await page.locator('#sticker-shape-menu-2').click();await page.locator('.sticker-choice-palette:popover-open').getByRole('tab',{name:'シールの型',exact:true}).click();await page.locator('.sticker-shape-palette:popover-open').getByRole('button',{name:'ハート',exact:true}).click();assert.equal(await page.locator('#sticker-open svg').getAttribute('data-sticker-shape'),'star');await page.keyboard.press('Escape');
  await page.locator('#sticker-menu').click();await call('desk_select',{ids:['a','b','line']});
  await page.locator('#sticker-open').click();
  a=await call('desk_get',{id:'a'});assert.equal(a.stickers.items.length,1);assert.equal(a.stickers.items2[0].shape,'star');
  assert.equal((await call('desk_get',{id:'b'})).stickers.items2[0].shape,'star');assert.equal((await call('desk_get',{id:'line'})).stickers,undefined);
  await call('desk_undo');assert.equal((await call('desk_get',{id:'a'})).stickers.items2?.length??0,0);
  await call('desk_select',{ids:['line']});assert.equal(await page.locator('#stamp-open').isDisabled(),true);assert.equal(await page.locator('#sticker-open').isDisabled(),true);
  await page.screenshot({path:'/tmp/tabletop-stationery-repeat.png'});assert.deepEqual(errors,[]);
 }finally{await close();}
});
