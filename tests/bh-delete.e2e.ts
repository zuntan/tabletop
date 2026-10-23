import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BH_DURATION} from '../src/bh-animation';
import {ERASER_DURATION,PARTICLE_DURATION} from '../src/stationery-delete-animation';
import {openTestDesk} from './desk-browser';

test('BH button commits one deletion, queues afterimages, and Undo rescues all; Delete stays instant',{timeout:30000},async()=>{
 const {page,call,close,errors}=await openTestDesk('bh-delete');
 try{
  await call('desk_execute',{operations:[
   {kind:'add',object:{id:'a',type:'text',x:100,y:80,width:230,height:160,text:'## すとーん\n本文',fill:'#fff7ed',fillOpacity:1}},
   {kind:'add',object:{id:'b',type:'rect',x:420,y:80,width:190,height:130,text:'図形'}},
   {kind:'add',object:{id:'line',type:'line',x:330,y:160,x2:420,y2:140,startBinding:{objectId:'a',anchor:'right'}}}
  ]});await call('desk_select',{ids:['a','b']});const before=await call('desk_summary');
  await page.locator('#delete').click();await page.locator('#bh-delete-overlay').waitFor();
  const state=await call('desk_context',{limit:1});assert.equal(state.revision,before.revision+1);assert.equal(state.count,1);
  assert.equal(state.objects[0].startBinding,null);
  await page.keyboard.press('Control+z');await page.waitForFunction(()=>!document.querySelector('#bh-delete-overlay'));
  assert.equal((await call('desk_summary')).count,3);assert.equal((await call('desk_get',{id:'line'})).startBinding.objectId,'a');
  await call('desk_select',{ids:['a']});await page.locator('#delete-style').click();await page.locator('#delete-suction').click();
  await page.locator('#bh-delete-overlay').waitFor();await page.waitForFunction(()=>!document.querySelector('#bh-delete-overlay'));
  assert.equal((await call('desk_summary')).count,2);
  await call('desk_undo');await call('desk_select',{ids:['a']});await page.locator('#canvas').click({position:{x:20,y:20}});
  await call('desk_select',{ids:['a']});await page.keyboard.press('Delete');assert.equal((await call('desk_summary')).count,2);
  assert.equal(await page.locator('#bh-delete-overlay').count(),0);
  assert.deepEqual(errors,[]);
 }finally{await close();}
});

test('media, clip, line and pin rasterize; locked bundles never partially delete',{timeout:30000},async()=>{
 const {page,call,close,errors}=await openTestDesk('bh-delete-media');
 try{
  await call('desk_asset_import',{id:'svg',source:{svg:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="45" fill="red"/></svg>'},x:100,y:100,width:180,height:200});
  await call('desk_execute',{operations:[
   {kind:'add',object:{id:'a',type:'text',x:350,y:100,width:200,height:160,text:'クリップの紙'}},
   {kind:'add',object:{id:'b',type:'text',x:370,y:120,width:200,height:160,text:'二枚目'}},
   {kind:'add',object:{id:'clip',type:'clip',clipMembers:['a','b'],clipStyle:'wire'}},
   {kind:'add',object:{id:'line',type:'line',x:100,y:340,x2:400,y2:340,strokeWidth:8,endMarker:'arrow'}},
   {kind:'series_add',series:{id:'pins',name:'ピン'}},
   {kind:'label_add',id:'pin',seriesId:'pins',x:500,y:300}
  ]});
  for(const ids of [['svg'],['line'],['pin']]){
   await call('desk_select',{ids});await page.locator('#delete').click();await page.locator('#bh-delete-overlay').waitFor();
   await call('desk_undo');await page.waitForFunction(()=>!document.querySelector('#bh-delete-overlay'));
  }
  await call('desk_execute',{operations:[{kind:'update',id:'clip',patch:{locked:true}}]});
  await call('desk_select',{ids:['a']});const locked=await call('desk_summary');await page.locator('#delete').click();
  await page.waitForFunction(()=>document.querySelector('#message')?.classList.contains('error'));
  assert.equal((await call('desk_summary')).revision,locked.revision);assert.equal(await page.locator('#bh-delete-overlay').count(),0);
  await call('desk_execute',{operations:[{kind:'update',id:'clip',patch:{locked:false}}]});
  await call('desk_select',{ids:['a']});await page.locator('#delete').click();await page.locator('#bh-delete-overlay').waitFor();
  const state=await call('desk_context',{limit:1});assert.ok(state.objects.some((o:{id:string})=>o.id==='b'));assert.ok(!state.objects.some((o:{id:string})=>o.id==='clip'));
  await call('desk_undo');await page.waitForFunction(()=>!document.querySelector('#bh-delete-overlay'));
  await page.emulateMedia({reducedMotion:'reduce'});await call('desk_select',{ids:['svg']});await page.locator('#delete').click();
  await page.waitForFunction(()=>!document.querySelector('[data-id="svg"]'));assert.equal(await page.locator('#bh-delete-overlay').count(),0);
  assert.deepEqual(errors,[]);
 }finally{await close();}
});


test('toolbar random choice stays the same across a multi-part deletion',{timeout:20000},async()=>{
 const {page,call,close}=await openTestDesk('bh-toolbar');
 try{
  await call('desk_execute',{operations:['a','b'].map((id,i)=>({kind:'add',object:{id,type:'text',x:100+i*300,y:100,text:id,width:220,height:140}}))});
  for(const [random,mode,duration] of [[.1,'fall',BH_DURATION],[.3,'suction',BH_DURATION],[.6,'eraser',ERASER_DURATION],[.9,'particles',PARTICLE_DURATION]] as const){
   await page.evaluate(value=>{Math.random=()=>value;},random);
   await call('desk_select',{ids:['a','b']});await page.locator('#delete-animated').click();
   await page.locator('#bh-delete-overlay').waitFor();assert.equal(await page.locator('#bh-delete-overlay').getAttribute('data-mode'),mode);
   await page.waitForTimeout(duration+150);assert.equal(await page.locator('#bh-delete-overlay').getAttribute('data-mode'),mode);
   assert.equal((await call('desk_summary')).count,0);
   await call('desk_undo');await page.waitForFunction(()=>!document.querySelector('#bh-delete-overlay'));
   assert.equal((await call('desk_summary')).count,2);
  }
 }finally{await close();}
});
