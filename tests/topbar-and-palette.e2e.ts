import assert from 'node:assert/strict';
import {test} from 'node:test';
import {openTestDesk} from './desk-browser';

test('compact topbar shares live undo, redo and lock without changing the camera transform', {timeout:30_000},async()=>{
 const {page,call,close,errors}=await openTestDesk('compact-topbar');
 try{
  await call('desk_execute',{operations:[{kind:'desk_rename',name:'青い開発机'},{kind:'add',object:{id:'note',type:'text',text:'Hello',x:100,y:100}}]});
  await call('desk_select',{ids:['note']});
  const before=await page.locator('#viewport').getAttribute('transform');
  const height=await page.locator('#canvas').evaluate(el=>el.getBoundingClientRect().height);
  await page.locator('#topbar-toggle').click();
  assert.equal(await page.locator('nav').isVisible(),false);
  assert.equal(await page.locator('#desk-name').textContent(),'青い開発机');
  assert.equal(await page.locator('#connection').isVisible(),true);
  assert.equal(await page.locator('header').evaluate(el=>el.getBoundingClientRect().height),32);
  assert.ok(await page.locator('#canvas').evaluate(el=>el.getBoundingClientRect().height)>height);
  assert.equal(await page.locator('#viewport').getAttribute('transform'),before);
  await page.locator('#mouse-lock').click();assert.equal((await call('desk_get',{id:'note'})).locked,true);
  await page.locator('#undo').click();assert.ok(!(await call('desk_get',{id:'note'})).locked);
  await page.locator('#redo').click();assert.equal((await call('desk_get',{id:'note'})).locked,true);
  assert.equal(await page.locator('#mouse-lock').getAttribute('aria-pressed'),'true');
  assert.equal(await page.evaluate(()=>localStorage.getItem('tabletop.topbar.collapsed')),'true');
  await page.screenshot({path:'/tmp/tabletop-compact-topbar.png'});
  await page.locator('#topbar-toggle').click();assert.equal(await page.locator('nav').isVisible(),true);
  assert.equal(await page.locator('nav #mouse-lock').count(),1);
  assert.deepEqual(errors,[]);
 }finally{await close();}
});

test('recommended palettes keep all colors available and remember the mode per role', {timeout:30_000},async()=>{
 const {page,call,close,errors}=await openTestDesk('recommended-palettes');
 try{
  await call('desk_execute',{operations:[{kind:'add',object:{id:'note',type:'text',text:'Palette'}}]});
  await call('desk_select',{ids:['note']});
  await page.locator('[data-color-role="fill"]').click();
  const palette=page.locator('.palette-fill');await palette.waitFor({state:'visible'});await palette.locator('.pcr-swatches button').first().waitFor({state:'visible'});
  assert.equal(await palette.locator('.pcr-swatches button:visible').count(),14);
  const revision=(await call('desk_summary')).revision;
  await palette.getByRole('button',{name:'全色',exact:true}).click();
  assert.equal(await palette.locator('.pcr-swatches button:visible').count(),42);
  assert.equal((await call('desk_summary')).revision,revision);
  await palette.getByRole('button',{name:'塗り #f87171',exact:true}).click();
  assert.equal((await call('desk_get',{id:'note'})).fill,'#f87171');
  await page.locator('[data-color-role="fill"]').click();assert.equal(await palette.getAttribute('data-palette-mode'),'all');
  await page.keyboard.press('Escape');await page.locator('[data-color-role="text"]').click();await page.locator('.palette-text').waitFor({state:'visible'});
  assert.equal(await page.locator('.palette-text').getAttribute('data-palette-mode'),'recommended');
  await page.screenshot({path:'/tmp/tabletop-recommended-palette.png'});
  assert.deepEqual(errors,[]);
 }finally{await close();}
});

test('two sticker rows and reaction size edit independently with shared Undo', {timeout:30_000},async()=>{
 const {page,call,close,errors}=await openTestDesk('two-sticker-rows');
 try{
  await call('desk_execute',{operations:[{kind:'add',object:{id:'note',type:'text',text:'Two rows',x:100,y:100,width:600,height:360,reactions:['✔']}}]});
  await call('desk_select',{ids:['note']});
  await page.locator('#sticker-add').click();await page.locator('#sticker-add-2').click();
  let note=await call('desk_get',{id:'note'});assert.equal(note.stickers.items.length,1);assert.equal(note.stickers.items2.length,1);assert.equal(note.stickers.origin,'bottom-right');
  assert.equal(await page.locator('[data-stickers="note"] svg').count(),2);
  await page.locator('#sticker-clear').click();note=await call('desk_get',{id:'note'});
  assert.equal(note.stickers.items.length,0);assert.equal(note.stickers.items2.length,1);
  assert.equal(await page.locator('[data-stickers="note"] svg').count(),1);
  await call('desk_undo');await page.locator('#sticker-clear-2').click();note=await call('desk_get',{id:'note'});
  assert.equal(note.stickers.items.length,1);assert.equal(note.stickers.items2.length,0);
  await page.locator('#reaction-size').fill('64');await page.locator('#reaction-size').press('Tab');
  assert.equal((await call('desk_get',{id:'note'})).reactionSize,64);
  const width=await page.locator('[data-reactions="note"] rect').evaluate(el=>el.getBoundingClientRect().width);
  await page.waitForTimeout(450); // Human property scrolling must finish before an AI camera request.
  await call('desk_camera_move',{zoom:.5,durationMs:0});
  const half=await page.locator('[data-reactions="note"] rect').evaluate(el=>el.getBoundingClientRect().width);
  assert.ok(Math.abs(width/2-half)<.1);
  await page.screenshot({path:'/tmp/tabletop-two-sticker-rows.png'});
  await call('desk_undo');assert.equal((await call('desk_get',{id:'note'})).reactionSize,undefined);
  assert.deepEqual(errors,[]);
 }finally{await close();}
});
