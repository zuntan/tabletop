import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDesk } from './desk-browser';

test('human selections show inert clip guides, follow geometry and zoom, and leave saved objects untouched', {timeout:30000},async()=>{
 const {page,call,close,errors}=await openTestDesk('clip-membership');
 try {
  await call('desk_execute',{operations:[
   ...['a','b','free'].map((id,i)=>({kind:'add',object:{id,type:'text',x:200+i*300,y:200,width:240,height:180,text:id}})),
   {kind:'add',object:{id:'clip',type:'clip',clipMembers:['a','b'],clipAnchor:'top-left',clipOffset:120}},
  ]});
  const before=await call('desk_state'),revision=(await call('desk_summary')).revision;
  await call('desk_point',{ids:['b']});assert.equal(await page.locator('[data-clip-membership]').count(),0);
  await call('desk_select',{ids:['a','b','free','clip']});
  const guides=page.locator('[data-clip-membership]');assert.equal(await guides.count(),2);
  const guide=page.locator('[data-clip-membership="b"]');assert.equal(await guide.getAttribute('pointer-events'),'none');assert.equal(await guide.getAttribute('stroke-opacity'),'0.6');
  assert.equal(await guide.locator('..').getAttribute('id'),'overlays');
  assert.deepEqual((await call('desk_state')).objects,before.objects);assert.equal((await call('desk_summary')).revision,revision);
  await call('desk_camera_move',{zoom:.5,durationMs:0});assert.equal(await guide.getAttribute('stroke-width'),'3');assert.equal(await guide.getAttribute('stroke-dasharray'),'8 8');
  await call('desk_execute',{operations:[{kind:'update',id:'a',patch:{width:800,height:600,x:300,y:400}}]});
  const clip=await call('desk_get',{id:'clip'});assert.equal(Number(await guide.getAttribute('x2')),clip.x+clip.width/2);assert.equal(Number(await guide.getAttribute('y2')),clip.y+clip.height/2);
  const order=await page.locator('#overlays').evaluate(el=>Array.from(el.children).map(n=>n.hasAttribute('data-clip-membership')?'guide':n.hasAttribute('data-human-selection')?'selection':'other'));assert.ok(order.lastIndexOf('guide')<order.indexOf('selection'));
  await call('desk_select',{ids:['clip']});assert.equal(await guides.count(),0);
  await call('desk_select',{ids:[]});assert.equal(await guides.count(),0);
  assert.deepEqual(errors,[]);
 } finally {await close();}
});
