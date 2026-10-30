import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openTestDesk} from './desk-browser';
import {stickerShapeIds,stickerShapeNames} from '../src/sticker-shapes';
import {mkdir} from 'node:fs/promises';

test('sticker controls append repeated colors, wrap/reflow, configure mixed targets and clear with Undo', {timeout:45000},async()=>{
 const {page,call,close,errors}=await openTestDesk('stickers');
 try {
  await call('desk_execute',{operations:[
   {kind:'add',object:{id:'note',type:'text',x:200,y:200,width:60,height:20,text:'note'}},
   {kind:'add',object:{id:'shape',type:'diamond',x:600,y:200}},
   {kind:'add',object:{id:'line',type:'line',x:100,y:500,x2:300,y2:500}},
  ]});
  await call('desk_select',{ids:['note']});
  const panel=page.locator('#sticker-controls');assert.equal(await panel.isVisible(),true);
  assert.equal(await panel.locator('#sticker-add').count(),0);
  assert.equal(await page.locator('#stamp-controls + #sticker-toolbar').count(),1);
  const iconCenters=await page.evaluate(()=>['stamp-open','sticker-open','reaction-more','prop-open'].map(id=>{const r=document.getElementById(id)!.querySelector('svg')!.getBoundingClientRect();return r.y+r.height/2;}));
  assert.ok(Math.max(...iconCenters)-Math.min(...iconCenters)<1);
  const openStickers=async()=>{if(!await page.locator('#sticker-palette').evaluate(e=>e.matches(':popover-open')))await page.locator('#sticker-open').click();};
  await openStickers();
  for(let i=0;i<7;i++)await page.locator('#sticker-add').click();
  let stickers=(await call('desk_get',{id:'note'})).stickers;assert.equal(stickers.items.length,7);assert.ok(stickers.items.every((c:{color:string})=>c.color==='#ef4444'));assert.equal(stickers.diameter,36);assert.equal(stickers.fixed,false);
  await mkdir('tmp/stickers',{recursive:true});await panel.screenshot({path:'tmp/stickers/controls.png'});
  const circles=page.locator('[data-id="note"] > [data-stickers] > svg');
  assert.equal(await circles.count(),7);assert.equal(Number(await circles.nth(3).getAttribute('y')),-137.6);
  assert.ok(Number(await circles.nth(6).getAttribute('y'))<0);assert.equal(await circles.nth(0).getAttribute('width'),'36');
  const rev=(await call('desk_summary')).revision;
  await call('desk_camera_move',{zoom:.5,durationMs:0});assert.equal(await circles.nth(0).getAttribute('width'),'36');assert.equal(await circles.nth(2).getAttribute('x'),'12');assert.equal((await call('desk_summary')).revision,rev);
  await page.getByRole('button',{name:'シールの配置起点の候補',exact:true}).click();
  await page.getByRole('dialog',{name:'シールの配置起点の候補',exact:true}).getByRole('button',{name:'右下',exact:true}).click();
  assert.equal(await circles.nth(0).getAttribute('x'),'12');assert.equal(await circles.nth(0).getAttribute('y'),'-8');assert.ok(Number(await circles.nth(6).getAttribute('y'))<0);
  await page.locator('#sticker-fixed').check();assert.equal(await circles.nth(0).getAttribute('width'),'72');await page.locator('#sticker-fixed').uncheck();
  await openStickers();await page.locator('[data-color-role="sticker-fill"]').click();await page.getByRole('button',{name:'シール #3b82f6',exact:true}).click();await page.locator('#sticker-add').click();
  assert.equal((await call('desk_get',{id:'note'})).stickers.items.at(-1).color,'#3b82f6');
  await page.locator('#sticker-shape-menu').click();await page.locator('.sticker-shape-palette:popover-open').getByRole('button',{name:'星',exact:true}).click();assert.equal(await page.locator('[data-color-role="sticker-fill"] svg').getAttribute('data-sticker-shape'),'star');await call('desk_select',{ids:['note','shape','line']});await page.locator('#sticker-add').click();
  assert.equal((await call('desk_get',{id:'shape'})).stickers.items[0].shape,'star');assert.equal(await page.locator('[data-id="shape"] > [data-stickers] > svg[data-sticker-shape="star"]').count(),1);assert.equal((await call('desk_get',{id:'line'})).stickers,undefined);
  await page.locator('#sticker-clear').click();assert.equal((await call('desk_get',{id:'note'})).stickers.items.length,0);assert.equal((await call('desk_get',{id:'note'})).stickers.origin,'bottom-right');
  await call('desk_undo');assert.equal((await call('desk_get',{id:'note'})).stickers.items.length,9);
  await call('desk_select',{ids:['line']});assert.equal(await panel.isVisible(),false);
  await call('desk_asset_import',{id:'image',source:{svg:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="yellow"/></svg>'},x:600,y:400,width:100,height:134});
  await call('desk_execute',{operations:[{kind:'add',object:{id:'mold',type:'rect',x:620,y:440,width:50,height:50}},{kind:'cutout',id:'image',moldId:'mold'},{kind:'update',id:'image',patch:{stickers:{colors:['red','blue','red']}}}]});
  assert.equal(await page.locator('[data-id="image"] > [data-stickers]').count(),1);assert.equal(await page.locator('[data-cutout-source] [data-stickers]').count(),0);
  await call('desk_execute',{operations:[{kind:'add',object:{id:'icons',type:'text',x:800,y:800,width:600,height:120}}]});
  await call('desk_select',{ids:['icons']});
  for(const id of stickerShapeIds){
    await page.locator('#sticker-shape-menu').click();
    await page.locator('.sticker-shape-palette:popover-open').getByRole('button',{name:stickerShapeNames[id],exact:true}).click();
    assert.equal(await page.locator('[data-color-role="sticker-fill"] svg').getAttribute('data-sticker-shape'),id);
    await page.locator('#sticker-add').click();
  }
  assert.deepEqual((await call('desk_get',{id:'icons'})).stickers.items.map((item:{shape:string})=>item.shape),stickerShapeIds);
  const glyphs=await page.locator('[data-id="icons"] > [data-stickers] > svg').evaluateAll(elements=>elements.map(element=>{
    const glyph=element as SVGSVGElement,view=glyph.viewBox.baseVal,bounds=glyph.getBBox();
    return {view:[view.x,view.y,view.width,view.height],bounds:[bounds.x,bounds.y,bounds.width,bounds.height]};
  }));
  for(const glyph of glyphs)for(let i=0;i<4;i++)assert.ok(Math.abs(glyph.view[i]-glyph.bounds[i])<.001);
  await page.locator('#sticker-add-2').click();
  assert.equal((await call('desk_get',{id:'icons'})).stickers.items2.length,1);
  await page.locator('#sticker-clear-2').click();
  assert.equal((await call('desk_get',{id:'icons'})).stickers.items2.length,0);
  await call('desk_undo');assert.equal((await call('desk_get',{id:'icons'})).stickers.items2.length,1);
  await page.locator('#sticker-palette').screenshot({path:'tmp/stickers/toolbar.png'});
  await call('desk_select',{ids:[]});assert.equal(await page.locator('#sticker-add').isDisabled(),true);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#sticker-palette').evaluate(e=>e.matches(':popover-open')),false);
  assert.deepEqual(errors,[]);
 }finally{await close();}
});
