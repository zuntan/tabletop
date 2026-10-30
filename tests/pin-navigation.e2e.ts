import assert from 'node:assert/strict';
import {test} from 'node:test';
import {openTestDesk} from './desk-browser';

test('selected pin offers adjacent trips, lands at the root and selects the destination', {timeout:40_000},async()=>{
 const {page,call,close,errors}=await openTestDesk('pin-navigation');
 try{
  await call('desk_execute',{operations:[
   {kind:'label_add',id:'p1',seriesId:'series-1',x:0,y:0},
   {kind:'label_add',id:'p2',seriesId:'series-1',x:1800,y:900},
   {kind:'label_add',id:'p3',seriesId:'series-1',x:3200,y:400},
   {kind:'add',object:{id:'memo',type:'text',x:0,y:200,text:'memo'}},
  ]});
  const a=await call('desk_get',{id:'p1'}),b=await call('desk_get',{id:'p2'});
  const root=(p:any)=>({x:p.x+p.width/2,y:p.y+p.height});
  await call('desk_camera_move',{center:root(a),zoom:.7,durationMs:0});
  let revision=(await call('desk_summary')).revision;
  await call('desk_select',{ids:['p1']});
  const popup=page.locator('#pin-navigation');assert.equal(await popup.isVisible(),true);await page.screenshot({path:'/tmp/tabletop-pin-navigation.png'});
  assert.equal(await popup.locator('[data-direction=previous]').isDisabled(),true);
  assert.equal(await popup.locator('[data-direction=next]').isEnabled(),true);
  // Editing keeps the pin selected, but removes controls that can cover the field.
  const pinBody=page.locator('[data-id="p1"]');
  await pinBody.dblclick();
  const input=page.locator('[data-inline-text]');
  await input.waitFor({state:'visible'});
  assert.equal(await popup.isVisible(),false);
  assert.deepEqual((await call('desk_selection')).ids,['p1']);
  await input.fill('cancelled description');
  await input.press('Escape');
  assert.equal(await popup.isVisible(),true);
  assert.ok(!(await call('desk_get',{id:'p1'})).description);
  await pinBody.dblclick();
  assert.equal(await popup.isVisible(),false);
  await input.fill('saved description');
  await input.press('Control+Enter');
  assert.equal(await popup.isVisible(),true);
  assert.equal((await call('desk_get',{id:'p1'})).description,'saved description');
  assert.deepEqual((await call('desk_selection')).ids,['p1']);
  revision=(await call('desk_summary')).revision;
  await popup.locator('[data-direction=next]').click();
  assert.deepEqual((await call('desk_selection')).ids,[],'departure clears the source pin selection');
  await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.includes('到着しました'));
  const arrived=await call('desk_camera_get');assert.deepEqual(arrived.center,root(b));assert.equal(arrived.zoom,.7);
  assert.deepEqual((await call('desk_selection')).ids,['p2']);assert.equal((await call('desk_summary')).revision,revision);
  assert.equal(await popup.isVisible(),true,'arrival offers the next trip at the destination');
  await call('desk_select',{ids:['p2']});assert.equal(await popup.isVisible(),true);
  assert.equal(await popup.locator('[data-direction=previous]').isEnabled(),true);
  assert.equal(await popup.locator('[data-direction=next]').isEnabled(),true);
  await popup.locator('[data-direction=previous]').click();
  await page.waitForSelector('[data-wayfinder-marker] circle');await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  assert.deepEqual((await call('desk_selection')).ids,[],'cancelled trip does not reselect its departure pin');
  assert.equal((await call('desk_camera_get')).navigation.reason,'human',await page.locator('#message').textContent()??'');
  await call('desk_select',{ids:['p1','p2']});assert.equal(await popup.isVisible(),false);
  await call('desk_select',{ids:['memo']});assert.equal(await popup.isVisible(),false);
  await call('desk_select',{ids:[]});assert.equal(await popup.isVisible(),false);
  assert.deepEqual(errors,[]);
 }finally{await close();}
});
