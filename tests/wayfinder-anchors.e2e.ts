import test from 'node:test';
import assert from 'node:assert/strict';
import {openTestDesk} from './desk-browser';

test('downward signpost has selectable artwork and a fixed screen-size launch popup',{timeout:45000},async()=>{
 const {page,call,close,errors}=await openTestDesk('wayfinder-four-anchors');
 try{
  await call('desk_execute',{operations:[
   {kind:'add',object:{id:'a',type:'text',x:200,y:200,width:240,height:120,text:'出発カード'}},
   {kind:'add',object:{id:'b',type:'text',x:200,y:1800,width:240,height:120,text:'到着カード'}},
   {kind:'add',object:{id:'go',type:'wayfinder',width:96,height:96,attachment:{objectId:'a',anchor:'bottom'},attachmentAnchor:'top',fill:'#dcfce7',fillOpacity:1,stroke:'#166534'}},
   {kind:'add',object:{id:'road',type:'line',startBinding:{objectId:'go',anchor:'bottom'},endBinding:{objectId:'b',anchor:'top'}}}
  ]});
  const go=await call('desk_get',{id:'go'});assert.equal(go.y,320);
  await call('desk_camera_move',{center:{x:320,y:350},zoom:1,durationMs:0});
  assert.equal(await page.locator('#wayfinder-navigation').isVisible(),false);
  assert.equal(await page.locator('#objects [data-wayfinder-run]').count(),0);
  await page.locator('[data-wayfinder-board=bottom]').click();
  assert.equal(await page.locator('#wayfinder-navigation').isVisible(),true);
  assert.equal(await page.locator('#wayfinder-navigation button').textContent(),'▼');
  const first=await page.locator('#wayfinder-navigation button').boundingBox();assert.ok(first);
  await call('desk_camera_move',{center:{x:320,y:350},zoom:.25,durationMs:0});
  const small=await page.locator('#wayfinder-navigation button').boundingBox();assert.ok(small);assert.equal(small.width,first.width);assert.equal(small.height,first.height);
  await page.locator('#wayfinder-navigation button').click();
  await page.waitForSelector('[data-wayfinder-marker] circle');assert.equal(await page.locator('#wayfinder-navigation').isVisible(),false);
  await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.includes('到着'),{timeout:10000});
  await call('desk_select',{ids:[]});assert.equal(await page.locator('#wayfinder-navigation').isVisible(),false);
  await call('desk_select',{ids:['go','a']});assert.equal(await page.locator('#wayfinder-navigation').isVisible(),false);
  await call('desk_select',{ids:['go']});await call('desk_camera_move',{center:{x:320,y:350},zoom:1,durationMs:0});
  await page.screenshot({path:'/tmp/tabletop-wayfinder-downward.png'});
  assert.deepEqual(errors,[]);
 }finally{await close();}
});
