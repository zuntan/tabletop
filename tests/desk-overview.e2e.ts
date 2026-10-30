import assert from 'node:assert/strict';
import {test} from 'node:test';
import {openTestDesk} from './desk-browser';

test('low-zoom footer warns about islands; two-rectangle overview opens without camera edits', {timeout:30_000},async()=>{
 const {page,call,close,errors}=await openTestDesk('desk-overview');
 try{
  await call('desk_execute',{operations:[
   {kind:'add',object:{id:'near',type:'text',x:0,y:0,width:100,height:100}},
   {kind:'add',object:{id:'island',type:'text',x:60000,y:60000,width:300,height:300}},
  ]});
  await call('desk_camera_move',{center:{x:0,y:0},zoom:.05,durationMs:0});
  const indicator=page.locator('#offscreen-indicator');await indicator.waitFor({state:'visible'});
  assert.equal(await indicator.textContent(),'画面外：→ ↓');
  const before=await call('desk_camera_get'),revision=(await call('desk_summary')).revision;
  await page.locator('#overview-toggle').click();await page.locator('#overview-panel').waitFor({state:'visible'});
  assert.equal(await page.locator('#overview-map rect').count(),2);
  const all=await page.locator('[data-overview-all]').getAttribute('x'),view=await page.locator('[data-overview-view]').getAttribute('x');assert.notEqual(all,view);
  const fills=await page.locator('#overview-map rect').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).fill));assert.notEqual(fills[0],fills[1]);
  assert.deepEqual(await call('desk_camera_get'),before);assert.equal((await call('desk_summary')).revision,revision);
  await page.screenshot({path:'/tmp/tabletop-desk-overview.png'});
  // No fully offscreen object remains, but one card extends beyond right/bottom.
  const visible=(await call('desk_camera_get')).visibleBounds;
  await call('desk_execute',{operations:[{kind:'update',id:'island',patch:{x:visible.x+visible.width-150,y:visible.y+visible.height-150}}]});
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  assert.equal(await indicator.textContent(),'画面外：→ ↓');
  await call('desk_camera_move',{center:{x:0,y:0},zoom:.1,durationMs:0});
  await indicator.waitFor({state:'hidden'});
  await page.locator('#overview-toggle').press('Space');await page.locator('#overview-panel').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>localStorage.getItem('tabletop.overview.open')),'false');
  assert.deepEqual(errors,[]);
 }finally{await close();}
});
