import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openTestDesk} from './desk-browser';
import {reactionBars,reactionMoons,reactionChoices} from '../src/reaction-values';

test('level strips stay together, bars are green, and fixed reactions keep their screen size',{timeout:45000},async()=>{
 const {page,call,close,errors}=await openTestDesk('reaction-levels');
 try{
  await call('desk_execute',{operations:[{kind:'add',object:{id:'note',type:'text',x:200,y:200,width:400,height:280,text:'棒の高さと月の満ち欠け',reactions:['▁','█','🌕']}}]});await call('desk_select',{ids:['note']});
  await page.locator('#reaction-more').click();
  assert.equal(await page.locator('#reaction-palette [data-reaction]').count(),41);
  assert.deepEqual(await page.locator('.reaction-bars button').allTextContents(),[...reactionBars]);assert.deepEqual(await page.locator('.reaction-moons button').allTextContents(),[...reactionMoons]);
  assert.equal(reactionChoices.length,41);
  const positions=await page.locator('.reaction-bars button').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().y));assert.equal(new Set(positions).size,1);
  const green=await page.locator('[data-reactions="note"] text').evaluateAll(nodes=>nodes.filter(n=>['▁','▂','▃','▄','▅','▆','▇','█'].includes(n.textContent??'')).map(n=>n.getAttribute('fill')));
  assert.deepEqual(green,['#15803d','#15803d']);
  await page.locator('#reaction-palette').screenshot({path:'/tmp/tabletop-reaction-level-palette.png'});
  await page.locator('#reaction-more').click();await page.locator('#reaction-fixed').check();
  const badge=page.locator('[data-reactions="note"] rect').first();const width=await badge.evaluate(n=>n.getBoundingClientRect().width);
  await page.waitForTimeout(450); // Let property-panel scrolling finish before the explicit camera action.
  await call('desk_camera_move',{zoom:.5,durationMs:0});const half=await badge.evaluate(n=>n.getBoundingClientRect().width);assert.ok(Math.abs(width-half)<.1);
  assert.equal((await call('desk_get',{id:'note'})).reactionFixed,true);
  await call('desk_undo');assert.equal((await call('desk_get',{id:'note'})).reactionFixed,undefined);assert.deepEqual(errors,[]);
 }finally{await close();}
});
