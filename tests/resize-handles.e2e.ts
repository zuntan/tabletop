import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDesk } from './desk-browser';

test('eight resize handles drag the correct edges, undo, and collapse on zoom or small cards', {timeout:60_000}, async () => {
  const {page,call,close,errors}=await openTestDesk('resize-handles');
  try {
    await call('desk_execute',{operations:[{kind:'grid_update',patch:{enabled:false}},
      {kind:'add',object:{id:'card',type:'text',x:200,y:200,width:360,height:240,text:'Resize this card'}},
      {kind:'add',object:{id:'small',type:'rect',x:650,y:200,width:60,height:60}},
      {kind:'add',object:{id:'line',type:'line',x:50,y:50,x2:200,y2:320,endBinding:{objectId:'card',anchor:'left'}}},
    ]});
    await call('desk_select',{ids:['card']});
    const handles=page.locator('[data-resize="card"]');
    assert.equal(await handles.count(),8);
    for(const direction of ['nw','n','ne','e','se','s','sw','w']) {
      const before=await call('desk_get',{id:'card'});
      const handle=page.locator(`[data-resize="card"][data-resize-handle="${direction}"]`);
      const box=(await handle.boundingBox())!;
      await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
      await page.mouse.move(box.x+box.width/2+30,box.y+box.height/2+20,{steps:3});await page.mouse.up();
      const after=await call('desk_get',{id:'card'});
      assert.equal(after.x, before.x+(direction.includes('w')?30:0));
      assert.equal(after.y, before.y+(direction.includes('n')?20:0));
      assert.equal(after.width,before.width+(direction.includes('w')?-30:direction.includes('e')?30:0));
      assert.equal(after.height,before.height+(direction.includes('n')?-20:direction.includes('s')?20:0));
      const line=await call('desk_get',{id:'line'});
      assert.equal(line.x2,after.x);assert.equal(line.y2,after.y+after.height/2);
      await call('desk_undo');assert.deepEqual(await call('desk_get',{id:'card'}),before);
    }
    await call('desk_camera_move',{zoom:.2,durationMs:0});
    assert.equal(await handles.count(),1);
    assert.equal(await handles.getAttribute('data-resize-handle'),'se');
    await call('desk_camera_move',{zoom:1,durationMs:0});assert.equal(await handles.count(),8);
    await call('desk_select',{ids:['small']});assert.equal(await page.locator('[data-resize="small"]').count(),1);
    await call('desk_execute',{operations:[{kind:'update',id:'small',patch:{locked:true}}]});
    assert.equal(await page.locator('[data-resize="small"]').count(),0);
    await call('desk_select',{ids:['card']});
    await call('desk_text_select',{action:'mode',id:'card'});
    assert.equal(await handles.count(),0);
    assert.deepEqual(errors,[]);
  } finally {await close();}
});
