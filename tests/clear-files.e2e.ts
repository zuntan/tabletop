import {callTestTool} from './mcp-call';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {openTestDesk} from './desk-browser';

test('clear files preserve layouts, disable individual geometry, support editing/stamps and release in place',{timeout:60000},async()=>{
 const {page,call,client,close,errors}=await openTestDesk('clear-files');
 try{
  await call('desk_execute',{operations:[{kind:'grid_update',patch:{enabled:false}},
   {kind:'add',object:{id:'a',type:'text',x:160,y:180,width:240,height:180,text:'中身はそのまま\n配置を保ってまとめる'}},
   {kind:'add',object:{id:'b',type:'rect',x:500,y:260,width:160,height:110,text:'図形'}},
   {kind:'add',object:{id:'line',type:'line',x:400,y:270,x2:500,y2:315,startBinding:{objectId:'a',anchor:'right'},endBinding:{objectId:'b',anchor:'left'}}},
  ]});await call('desk_select',{ids:['a','b','line']});await page.locator('#file-create').click();
  let state=await call('desk_state');const file=state.objects.find((o:{type:string})=>o.type==='file');assert.ok(file);const id=file.id;
  assert.deepEqual(file.fileMembers,['a','b','line']);assert.equal((await call('desk_get',{id:'a'})).x,160);
  assert.equal(await page.locator(`[data-id="${id}"] [data-file-inner]`).count(),1);assert.equal(await page.locator(`[data-id="${id}"] [data-file-title]`).textContent(),'クリアファイル');
  await page.locator('[name="text"]').fill('配置のファイル');await page.locator('[name="text"]').dispatchEvent('change');assert.equal((await call('desk_get',{id})).text,'配置のファイル');
  await page.locator('#stamp-menu').click();await page.locator('[data-stamp-design="done_ja"]').click();assert.equal((await call('desk_get',{id})).stamp.designId,'done_ja');await page.locator('#stamp-menu').click();
  assert.equal(await page.locator('#properties [name="width"]').isDisabled(),true);
  await call('desk_select',{ids:['a']});assert.equal(await page.locator('[name="x"]').isDisabled(),true);assert.equal(await page.locator('[data-resize="a"]').count(),0);
  assert.equal(await page.locator('#front').isDisabled(),true);
  await page.locator('[name="text"]').fill('本文は編集できます');await page.locator('[name="text"]').dispatchEvent('change');assert.equal((await call('desk_get',{id:'a'})).text,'本文は編集できます');
  const invalid=await callTestTool(client, {name:'desk_execute',arguments:{operations:[{kind:'update',id:'a',patch:{width:500}}]}});assert.equal(invalid.isError,true);
  await page.locator('#canvas').focus();await page.keyboard.press('Control+Shift+g');assert.ok(await call('desk_get',{id}));
  // Drag the body, not a special group handle: the complete file moves.
  const position=await page.locator('#viewport').evaluate((el)=>{const p=new DOMPoint(220,240).matrixTransform((el as unknown as SVGGraphicsElement).getScreenCTM()!);return{x:p.x,y:p.y};});
  await page.mouse.move(position.x,position.y);await page.mouse.down();await page.mouse.move(position.x+48,position.y+24,{steps:5});await page.mouse.up();
  assert.equal((await call('desk_get',{id:'a'})).x,208);assert.equal((await call('desk_get',{id:'b'})).x,548);
  await call('desk_select',{ids:[]});await mkdir('tmp/clear-files',{recursive:true});await page.screenshot({path:'tmp/clear-files/layout.png'});
  await call('desk_select',{ids:[id]});await page.locator('#canvas').focus();await page.keyboard.press('Control+c');await page.keyboard.press('Control+v');
  const copied=(await call('desk_state')).objects.find((o:{type:string;id:string})=>o.type==='file'&&o.id!==id);assert.ok(copied);assert.equal(copied.fileMembers.length,3);
  await call('desk_execute',{operations:[{kind:'delete',id:copied.id},...copied.fileMembers.map((id:string)=>({kind:'delete',id}))]});
  const a=await call('desk_get',{id:'a'});await call('desk_select',{ids:[id]});await page.locator('#canvas').focus();await page.keyboard.press('Control+Shift+g');
  state=await call('desk_state');assert.equal(state.objects.some((o:{id:string})=>o.id===id),false);assert.deepEqual(await call('desk_get',{id:'a'}),a);
  await call('desk_undo');assert.ok(await call('desk_get',{id}));assert.deepEqual(errors,[]);
 }finally{await close();}
});

test('clip inclusion is whole-bundle, structural controls are frozen, and invalid selected types show status',{timeout:60000},async()=>{
 const {page,call,close,errors}=await openTestDesk('clear-file-clips');
 try{
  await call('desk_execute',{operations:[{kind:'grid_update',patch:{enabled:false}},
   {kind:'add',object:{id:'a',type:'text',x:200,y:200,width:300,height:180,text:'クリップの紙1'}},
   {kind:'add',object:{id:'b',type:'text',x:600,y:300,width:300,height:180,text:'クリップの紙2'}},
   {kind:'add',object:{id:'clip',type:'clip',clipMembers:['a','b']}},
   {kind:'label_add',id:'pin',seriesId:'series-1',x:900,y:200},
  ]});await call('desk_select',{ids:['pin','a']});const revision=(await call('desk_summary')).revision;await page.locator('#file-create').click();
  assert.match(await page.locator('#message').textContent()??'',/ピン・小物/);assert.equal((await call('desk_summary')).revision,revision);
  await call('desk_select',{ids:['b']});await page.locator('#file-create').click();const file=(await call('desk_state')).objects.find((o:{type:string})=>o.type==='file');assert.deepEqual(new Set(file.fileMembers),new Set(['a','b','clip']));
  await call('desk_select',{ids:['clip']});assert.equal(await page.locator('[name="clipOffset"]').isDisabled(),true);await page.locator('#canvas').focus();await page.keyboard.press('Delete');assert.ok(await call('desk_get',{id:'clip'}));
  await call('desk_select',{ids:[file.id]});await page.locator('#canvas').focus();await page.keyboard.press('Delete');assert.deepEqual((await call('desk_get',{id:'clip'})).clipMembers,['a','b']);
  assert.deepEqual(errors,[]);
 }finally{await close();}
});
