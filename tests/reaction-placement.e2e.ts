import assert from 'node:assert/strict';
import {test} from 'node:test';
import {openTestDesk} from './desk-browser';

test('reaction placement picker moves marks to the exposed edge of clipped cards without changing their stacking', {timeout:30_000},async()=>{
 const {page,call,close,errors}=await openTestDesk('reaction-placement');
 try{
  await call('desk_execute',{operations:[
   {kind:'add',object:{id:'a',type:'text',x:200,y:200,width:300,height:180,text:'Top clipped card',reactions:['✔','👀','💡']}},
   {kind:'add',object:{id:'b',type:'text',x:200,y:250,width:300,height:180,text:'Following card'}},
   {kind:'add',object:{id:'clip',type:'clip',clipMembers:['a','b'],clipAnchor:'top',clipOffset:50}},
  ]});
  await call('desk_select',{ids:['a']});
  await page.locator('#properties').getByRole('button',{name:'文字サイズの候補',exact:true}).click();
  assert.deepEqual(await page.locator('.number-preset-palette:popover-open .number-preset-choices button').allTextContents(),['12','16','24','32','48','64']);
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'リアクションの大きさの候補',exact:true}).click();
  assert.deepEqual(await page.locator('.number-preset-palette:popover-open .number-preset-choices button').allTextContents(),['24','32','48','64','96','128']);
  await page.keyboard.press('Escape');
  const controls=await page.locator('#reaction-size-controls label').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().toJSON()));
  assert.ok(Math.abs(controls[0].y+controls[0].height/2-controls[1].y-controls[1].height/2)<2);
  const ids=(await call('desk_state')).objects.map((o:{id:string})=>o.id);
  await page.locator('#reaction-placement-menu').click();
  const picker=page.locator('.reaction-placement-palette:popover-open');
  assert.equal(await picker.locator('.reaction-corner-options').count(),4);
  assert.equal(await picker.locator('button').count(),8);
  await page.screenshot({path:'/tmp/tabletop-reaction-placement-picker.png'});
  await picker.getByRole('button',{name:'左上→',exact:true}).click();
  assert.equal((await call('desk_get',{id:'a'})).reactionPlacement,'top-left-right');
  const body=await page.locator('[data-id="a"] > rect').first().boundingBox();
  const badges=await page.locator('[data-reactions="a"]').boundingBox();
  assert.ok(badges!.y+badges!.height<body!.y);
  assert.deepEqual((await call('desk_state')).objects.map((o:{id:string})=>o.id),ids);
  await call('desk_undo');assert.equal((await call('desk_get',{id:'a'})).reactionPlacement,undefined);
  await page.locator('#reaction-placement-menu').click();
  await page.locator('.reaction-placement-palette:popover-open').getByRole('button',{name:'左上↓',exact:true}).click();
  const rects=await page.locator('[data-reactions="a"] rect').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().toJSON()));
  assert.equal(rects[0].x,rects[1].x);assert.ok(rects[1].y>rects[0].y);assert.ok(rects[0].x+rects[0].width<body!.x);
  await page.screenshot({path:'/tmp/tabletop-reaction-placement-result.png'});
  assert.deepEqual(errors,[]);
 }finally{await close();}
});
