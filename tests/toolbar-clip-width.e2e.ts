import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDesk } from './desk-browser';

test('clip uses the shared compact icon button after text; toolbar width updates selected text frames and lines', {timeout:30_000}, async()=>{
 const {page,call,close,errors}=await openTestDesk('toolbar-clip-width');
 try {
  assert.equal(await page.locator('[data-add="text"] + #clip-create.tool-button .ui-icon').count(),1);
  assert.equal(await page.locator('#clip-create .tool-caption').textContent(),'クリップ');
  const heights=await page.locator('[data-add="text"], #clip-create').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().height));assert.equal(heights[0],heights[1]);
  await call('desk_execute',{operations:[{kind:'add',object:{id:'text',type:'text',stroke:'#000000',text:'Frame'}},{kind:'add',object:{id:'line',type:'line',x:300,x2:450,y2:0}}]});
  await call('desk_select',{ids:['text','line']});
  await page.locator('#default-width').fill('8');await page.locator('#default-width').dispatchEvent('change');
  assert.equal((await call('desk_get',{id:'text'})).strokeWidth,8);assert.equal((await call('desk_get',{id:'line'})).strokeWidth,8);
  assert.equal((await call('desk_settings')).defaults.strokeWidth,8);
  await call('desk_undo');assert.equal((await call('desk_get',{id:'text'})).strokeWidth,2);
  assert.deepEqual(errors,[]);
 } finally {await close();}
});
