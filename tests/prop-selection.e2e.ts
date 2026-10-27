import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openTestDesk } from './desk-browser';

test('prop head selection passes through artwork, moves from the head, prevents human resize and survives save/load', { timeout: 60_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('prop-selection');
  const dir = await mkdtemp(join(tmpdir(), 'tabletop-prop-selection-'));
  const src = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="green"/></svg>').toString('base64');
  const point = async (x: number, y: number) => page.evaluate(({x,y}) => {
    const layer = document.querySelector('#canvas [data-id]')!.parentElement as unknown as SVGGraphicsElement;
    const p = new DOMPoint(x,y).matrixTransform(layer.getScreenCTM()!); return {x:p.x,y:p.y};
  }, {x,y});
  const click = async (x:number,y:number) => {const p=await point(x,y);await page.mouse.click(p.x,p.y);};
  try {
    await call('desk_execute', { operations: [
      {kind:'grid_update',patch:{enabled:false}},
      {kind:'add',object:{id:'card',type:'text',x:150,y:170,width:180,height:100,text:'behind'}},
      {kind:'add',object:{id:'area',type:'prop',x:100,y:100,width:500,height:400,src,text:'area'}},
      {kind:'add',object:{id:'other',type:'prop',x:650,y:100,width:180,height:200,src,text:'other'}},
    ]});
    // Legacy mode keeps the entire rectangle as the hit target.
    await click(200,200); assert.deepEqual((await call('desk_context')).selection,['area']);
    await page.getByRole('switch',{name:'ヘッド選択',exact:true}).click();
    assert.equal(await page.getByRole('switch',{name:'ヘッド選択',exact:true}).getAttribute('aria-checked'),'true');
    assert.ok(Number(await page.locator('[data-human-selection="area"]').getAttribute('height'))<100);
    assert.equal((await call('desk_get',{id:'area'})).propSelection,'head');
    assert.equal(await page.locator('[data-resize="area"]').count(),0);
    assert.equal(await page.locator('#properties [name="width"]').isDisabled(),true);
    assert.equal(await page.locator('#properties [name="height"]').isDisabled(),true);
    await click(200,200); assert.deepEqual((await call('desk_context')).selection,['card']);
    assert.equal(await page.getByRole('switch',{name:'ヘッド選択',exact:true}).isVisible(),false);
    await click(500,400); assert.deepEqual((await call('desk_context')).selection,[]);
    const from=await point(130,115),to=await point(170,145);
    await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:5});await page.mouse.up();
    const moved=await call('desk_get',{id:'area'});
    assert.equal(moved.x,140);assert.equal(moved.y,130);
    assert.equal((await call('desk_get',{id:'card'})).x,150);
    assert.equal(moved.width,500);assert.equal(moved.height,400);
    // The head includes the full width, even away from the title glyphs.
    await click(620,145);assert.deepEqual((await call('desk_context')).selection,['area']);
    const saved=await call('desk_save',{path:join(dir,'desk.tabletop')});
    await call('desk_execute',{operations:[{kind:'update',id:'area',patch:{propSelection:'normal'}}]});
    const context=await call('desk_context');
    await call('desk_load',{path:saved.path,confirm:true,expectedSessionId:context.sessionId,expectedRevision:context.revision});
    assert.equal((await call('desk_get',{id:'area'})).propSelection,'head');
    await page.locator('[data-id="area"] [data-prop-body]').click({position:{x:20,y:10}});
    await page.getByRole('switch',{name:'ヘッド選択',exact:true}).click();
    assert.equal(await page.locator('[data-resize="area"]').count(),1);
    assert.equal(await page.locator('#properties [name="width"]').isDisabled(),false);
    assert.equal((await call('desk_get',{id:'other'})).propSelection,undefined);
    assert.deepEqual(errors,[]);
  } finally {await close();await rm(dir,{recursive:true,force:true});}
});
