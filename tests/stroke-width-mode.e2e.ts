import test from 'node:test';
import assert from 'node:assert/strict';
import {openTestDesk} from './desk-browser';

test('line and thread switches distinguish zoom-following and fixed widths, including markers and rounded strokes',{timeout:45000},async()=>{
 const {page,call,close,errors}=await openTestDesk('stroke-width-mode');
 try{
  await call('desk_execute',{operations:[
   {kind:'add',object:{id:'fixed',type:'line',x:0,y:0,x2:1000,y2:0,strokeWidth:8,fixedWidth:true,endMarker:'arrow',dash:'dashed'}},
   {kind:'add',object:{id:'follow',type:'line',x:0,y:150,x2:1000,y2:150,strokeWidth:8,endMarker:'arrow'}},
   {kind:'add',object:{id:'corner-a',type:'line',x:0,y:300,x2:300,y2:300,strokeWidth:8,fixedWidth:true,endJunction:'j',junctionRounding:48}},
   {kind:'add',object:{id:'corner-b',type:'line',x:300,y:300,x2:300,y2:600,strokeWidth:8,startJunction:'j',junctionRounding:48}},
   {kind:'series_update',id:'series-1',patch:{thread:{enabled:true,visible:true,width:8,dash:'dashed'}}},
   {kind:'label_add',id:'p1',seriesId:'series-1',x:100,y:700},{kind:'label_add',id:'p2',seriesId:'series-1',x:800,y:700}
  ]});
  await call('desk_camera_move',{center:{x:500,y:350},zoom:1,durationMs:0});
  const marker=(id:string)=>page.locator(`[data-id="${id}"] .connector-marker`);
  const f1=await marker('fixed').boundingBox(),z1=await marker('follow').boundingBox();assert.ok(f1&&z1);
  assert.equal(await page.locator('[data-id=fixed] .connector-line').getAttribute('vector-effect'),'non-scaling-stroke');
  assert.equal(await page.locator('[data-id=follow] .connector-line').getAttribute('vector-effect'),null);
  assert.equal(await page.locator('[data-id=corner-a] .junction-curve').getAttribute('vector-effect'),'non-scaling-stroke');
  assert.equal(await page.locator('[data-pin-thread]').getAttribute('vector-effect'),null);
  await call('desk_camera_move',{zoom:.25,durationMs:0});
  const f2=await marker('fixed').boundingBox(),z2=await marker('follow').boundingBox();assert.ok(f2&&z2);
  assert.ok(Math.abs(f1.height-f2.height)<.1,'fixed marker keeps screen size');assert.ok(Math.abs(z1.height*.25-z2.height)<.1,'following marker scales');
  await call('desk_select',{ids:['follow']});const lineSwitch=page.getByRole('switch',{name:'線の太さ固定',exact:true});assert.equal(await lineSwitch.getAttribute('aria-checked'),'false');
  const switchBounds=await lineSwitch.locator('..').boundingBox(),formBounds=await page.locator('#properties').boundingBox();assert.ok(switchBounds&&formBounds);assert.ok(switchBounds.x+switchBounds.width<=formBounds.x+formBounds.width+1,'mode labels stay inside sidebar');
  await lineSwitch.click();assert.equal((await call('desk_get',{id:'follow'})).fixedWidth,true);assert.equal(await lineSwitch.getAttribute('aria-checked'),'true');
  await call('desk_undo');assert.equal(await lineSwitch.getAttribute('aria-checked'),'false');
  await call('desk_select',{ids:['p1']});const threadSwitch=page.getByRole('switch',{name:'ピンの糸の太さ固定',exact:true});assert.equal(await threadSwitch.getAttribute('aria-checked'),'false');
  await threadSwitch.click();assert.equal((await call('desk_settings')).series[0].thread.fixedWidth,true);assert.equal(await page.locator('[data-pin-thread]').getAttribute('vector-effect'),'non-scaling-stroke');
  await call('desk_select',{ids:['follow']});await page.screenshot({path:'/tmp/tabletop-stroke-width-mode.png'});
  assert.deepEqual(errors,[]);
 }finally{await close();}
});
