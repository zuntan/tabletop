import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openTestDesk} from './desk-browser';
test('clip percentage UI presets switch modes and publish saved percentage fields',{timeout:30000},async()=>{
 const {page,call,close,errors}=await openTestDesk('clip-percent');
 try{
  await call('desk_execute',{operations:[
   {kind:'add',object:{id:'a',type:'text',x:0,y:0,width:200,height:100}},
   {kind:'add',object:{id:'b',type:'text',x:0,y:0,width:400,height:300}},
   {kind:'add',object:{id:'clip',type:'clip',clipMembers:['a','b'],clipAnchor:'left',clipOffset:32}},
  ]});await call('desk_select',{ids:['clip']});
  await page.getByRole('button',{name:'間隔の指定の候補',exact:true}).click();
  await page.getByRole('dialog',{name:'間隔の指定の候補',exact:true}).getByRole('button',{name:'割合（直前の紙）',exact:true}).click();
  const input=page.locator('[name="clipOffsetPercent"]');await input.waitFor({state:'visible'});assert.equal(await input.inputValue(),'30');assert.equal(await page.locator('[name="clipOffset"]').isVisible(),false);
  await page.getByRole('button',{name:'クリップの割合（%）の候補',exact:true}).click();
  const palette=page.getByRole('dialog',{name:'クリップの割合（%）の候補',exact:true});
  assert.deepEqual(await palette.locator('.number-preset-choices button').allTextContents(),['隙間無し（100%）','90%','60%','30%','10%']);await palette.getByRole('button',{name:'隙間無し（100%）',exact:true}).click();
  const clip=await call('desk_get',{id:'clip'});assert.equal(clip.clipOffsetMode,'percent');assert.equal(clip.clipOffsetPercent,100);assert.equal(clip.clipOffset,32);
  assert.equal((await call('desk_get',{id:'b'})).x,200);
  await input.fill('120');await input.press('Enter');assert.equal((await call('desk_get',{id:'b'})).x,240);
  await page.getByRole('button',{name:'間隔の指定の候補',exact:true}).click();await page.getByRole('dialog',{name:'間隔の指定の候補',exact:true}).getByRole('button',{name:'固定距離',exact:true}).click();
  assert.equal(await page.locator('[name="clipOffset"]').inputValue(),'32');assert.equal((await call('desk_get',{id:'b'})).x,32);
  await page.getByRole('button',{name:'間隔の指定の候補',exact:true}).click();await page.getByRole('dialog',{name:'間隔の指定の候補',exact:true}).getByRole('button',{name:'割合（1枚目の短辺）',exact:true}).click();
  assert.equal(await input.inputValue(),'120');assert.equal((await call('desk_get',{id:'clip'})).clipOffsetMode,'base-short-side');assert.equal((await call('desk_get',{id:'b'})).x,120);await page.getByRole('button',{name:'クリップの割合（%）の候補',exact:true}).click();
  assert.deepEqual(await palette.locator('.number-preset-choices button').allTextContents(),['10','30','60','90','100']);await page.keyboard.press('Escape');assert.deepEqual(errors,[]);
 }finally{await close();}
});
