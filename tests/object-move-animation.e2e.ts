import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDesk } from './desk-browser';

test('pointed moves ease with connected geometry, one committed revision, interruption, and instant alternatives', {timeout:30_000},async()=>{
 const {page,call:send,close,errors}=await openTestDesk('object-move-animation');page.setDefaultTimeout(5000);
 let step=0;const call=async(name:string,args:Record<string,unknown>={})=>{const current=++step;try{return await send(name,args)}catch(error){throw new Error(`Step ${current} ${name}: ${String(error)}; page errors: ${errors.join('; ')}`)}};
 page.on('crash',()=>errors.push('Browser page crashed'));
 const x=()=>page.locator('[data-id="a"]').evaluate(node=>(node as unknown as SVGGraphicsElement).transform.baseVal.consolidate()!.matrix.e);
 try{
  await call('desk_execute',{operations:[
   {kind:'add',object:{id:'a',type:'text',x:100,y:100,text:'move',width:180,height:120}},
   {kind:'add',object:{id:'b',type:'text',x:400,y:100,text:'other'}},
   {kind:'add',object:{id:'line',type:'line',x:0,y:0,x2:800,y2:160,startBinding:{objectId:'a',anchor:'right'}}},
  ]});await call('desk_point',{ids:['a']});
  const before=await call('desk_summary');
  let pending=call('desk_execute',{operations:[{kind:'update',id:'a',patch:{x:300,y:180}}]});void pending.catch(()=>{});
  await page.waitForFunction(()=>document.querySelector('#canvas')?.getAttribute('data-object-moving')==='true');
  await page.waitForFunction(()=>{const g=document.querySelector('[data-id="a"]') as unknown as SVGGraphicsElement;const x=g.transform.baseVal.consolidate()!.matrix.e;return x>100&&x<300});
  const mid=await x();assert.ok(mid>100&&mid<300);
  const endpoints=await page.evaluate(()=>{const a=document.querySelector('[data-id="a"]') as unknown as SVGGraphicsElement;const line=document.querySelector('[data-id="line"]') as unknown as SVGGraphicsElement;return{body:a.transform.baseVal.consolidate()!.matrix.e,line:line.transform.baseVal.consolidate()!.matrix.e};});assert.ok(Math.abs(endpoints.line-endpoints.body-180)<.001,JSON.stringify(endpoints));
  const state=await call('desk_context',{limit:1});assert.equal(state.objects.find((o:{id:string})=>o.id==='a').x,300);assert.equal(state.revision,before.revision+1);
  const response=await pending;assert.equal(response.animation.status,'completed');assert.equal(await x(),300);
  assert.equal((await call('desk_selection')).aiPointing[0],'a');
  await call('desk_undo');assert.equal((await call('desk_get',{id:'a'})).x,100);
  pending=call('desk_execute',{operations:[{kind:'update',id:'a',patch:{x:500,y:220}}]});void pending.catch(()=>{});
  await page.waitForFunction(()=>document.querySelector('#canvas')?.getAttribute('data-object-moving')==='true');
  await page.locator('#revision').click();const interrupted=await pending;assert.equal(interrupted.animation.status,'interrupted');assert.equal(await x(),500);
  const mixed=await call('desk_execute',{operations:[{kind:'update',id:'a',patch:{x:520,text:'changed'}}]});assert.equal(mixed.animation,undefined);assert.equal(await x(),520);
  await call('desk_point',{ids:[]});const unpointed=await call('desk_execute',{operations:[{kind:'update',id:'a',patch:{x:540}}]});assert.equal(unpointed.animation,undefined);assert.equal(await x(),540);
  await page.emulateMedia({reducedMotion:'reduce'});await call('desk_point',{ids:['a']});const reduced=await call('desk_execute',{operations:[{kind:'update',id:'a',patch:{x:560}}]});assert.equal(reduced.animation,undefined);assert.equal(await x(),560);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await call('desk_point',{ids:['a','b']});const together=await call('desk_execute',{operations:[{kind:'update',id:'a',patch:{x:600,y:260}},{kind:'update',id:'b',patch:{x:440,y:140}}]});assert.equal(together.animation.status,'completed');
  await call('desk_execute',{operations:[{kind:'add',object:{id:'clip',type:'clip',clipMembers:['a','b'],clipStyle:'wire'}}]});
  await call('desk_point',{ids:['clip']});const base=await call('desk_get',{id:'a'}),follower=await call('desk_get',{id:'b'});
  const bundle=await call('desk_execute',{operations:[{kind:'update',id:'a',patch:{x:base.x+60,y:base.y+30}}]});assert.equal(bundle.animation.status,'completed');assert.equal((await call('desk_get',{id:'b'})).x,follower.x+60);
  assert.deepEqual(errors,[]);
 }finally{await close();}
});
