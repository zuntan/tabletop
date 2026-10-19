import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';
test('rounded corner UI, saved numeric value, Undo and detach', {timeout:30000}, async()=>{
  const {page,call,close,errors}=await openTestDesk('junction-rounding');
  page.setDefaultTimeout(5000);
  try {
    await call('desk_execute',{operations:[
      {kind:'grid_update',patch:{enabled:false}},
      {kind:'add',object:{id:'a',type:'line',x:0,y:0,x2:200,y2:0,endJunction:'j',strokeWidth:8}},
      {kind:'add',object:{id:'b',type:'line',x:200,y:0,x2:200,y2:200,startJunction:'j'}},
    ]});
    await call('desk_select',{ids:['a']});
    await page.getByRole('button',{name:'接合部の丸めの候補',exact:true}).click();
    await page.getByRole('dialog',{name:'接合部の丸めの候補',exact:true}).getByRole('button',{name:'中 (96)',exact:true}).click();
    assert.equal((await call('desk_get',{id:'a'})).junctionRounding,96);
    assert.equal(await page.locator('.junction-curve').count(),1);
    assert.equal(await page.locator('[data-id="a"] .connector-line').getAttribute('x2'),'110');
    assert.equal(await page.locator('[data-id="b"] .connector-line').getAttribute('y1'),'90');
    // During endpoint dragging both shafts and the single curve must follow before release.
    const handle=page.locator('[data-connector="a"][data-endpoint="end"]');
    const box=(await handle.boundingBox())!;
    const target=await page.locator('#viewport').evaluate(el=>{
      const m=(el as unknown as SVGGraphicsElement).getScreenCTM()!;
      const p=new DOMPoint(220,40).matrixTransform(m); return {x:p.x,y:p.y};
    });
    const oldPath=await page.locator('.junction-curve').getAttribute('d');
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2); await page.mouse.down();
    await page.mouse.move(target.x,target.y,{steps:4});
    assert.equal(await page.locator('.junction-curve').count(),1);
    assert.notEqual(await page.locator('.junction-curve').getAttribute('d'),oldPath);
    await page.mouse.up(); await call('desk_undo');
    const saved=await call('desk_save',{filename:`rounding-${Date.now()}.tabletop`});
    await call('desk_undo'); assert.equal(await page.locator('.junction-curve').count(),0);
    const state=await call('desk_summary');
    await call('desk_load',{filename:saved.filename,confirm:true,expectedSessionId:state.sessionId,expectedRevision:state.revision});
    assert.equal((await call('desk_get',{id:'a'})).junctionRounding,96);
    assert.equal(await page.locator('.junction-curve').count(),1);
    await call('desk_execute',{operations:[{kind:'update',id:'b',patch:{startJunction:null}}]});
    assert.equal(await page.locator('.junction-curve').count(),0);
    assert.equal(await page.locator('[data-id="a"] .connector-line').getAttribute('x2'),'200');
    assert.deepEqual(errors,[]);
  } finally {await close();}
});
