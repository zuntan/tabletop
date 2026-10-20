import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDesk } from './desk-browser';

test('pin toolbar adds immediately; selected/last/arbitrary/new series and first-pin Undo are consistent', {timeout:30_000},async()=>{
 const {page,call,close,errors}=await openTestDesk('pin-toolbar-add');page.setDefaultTimeout(5000);
 const add=async()=>{await page.locator('#numbering').click();const id=(await call('desk_selection')).ids[0];return call('desk_get',{id})};
 const choose=async(id:string)=>{await page.locator('#pin-series-menu').click();await page.locator(`[data-pin-series="${id}"]`).click();return(await call('desk_selection')).ids[0]};
 try{
  assert.equal(await page.locator('#series-add').count(),0);
  const first=await add();assert.equal(first.type,'label');assert.equal(first.seriesId,'series-1');assert.equal(first.number,1);
  assert.equal((first.x+first.width/2)%24,0);assert.equal((first.y+first.height)%24,0);
  const second=await add();assert.equal(second.number,2);assert.equal(second.seriesId,first.seriesId);
  const count=(await call('desk_summary')).count;await page.locator('#canvas').click({position:{x:800,y:500}});assert.equal((await call('desk_summary')).count,count);
  assert.equal((await add()).number,3);
  const revision=(await call('desk_summary')).revision;
  await page.locator('#pin-series-menu').click();await page.locator('#pin-series-new').click();
  const newId=(await call('desk_selection')).ids[0],fresh=await call('desk_get',{id:newId});assert.notEqual(fresh.seriesId,first.seriesId);assert.equal(fresh.number,1);assert.equal((await call('desk_summary')).revision,revision+1);
  await call('desk_undo');assert.equal((await call('desk_settings')).series.length,1);await call('desk_redo');assert.equal((await call('desk_settings')).series.length,2);
  await call('desk_select',{ids:[newId]});await page.locator('#canvas').focus();await page.keyboard.press('Delete');assert.equal((await call('desk_settings')).series.length,2);
  await call('desk_select',{ids:[]});assert.equal((await add()).seriesId,fresh.seriesId);
  await call('desk_select',{ids:[first.id,second.id]});assert.equal((await add()).seriesId,first.seriesId);
  const arbitraryId=await choose(fresh.seriesId);assert.equal((await call('desk_get',{id:arbitraryId})).seriesId,fresh.seriesId);
  await call('desk_select',{ids:[first.id,arbitraryId]});assert.equal((await add()).seriesId,fresh.seriesId);
  await call('desk_select',{ids:[first.id]});assert.equal((await add()).seriesId,first.seriesId);
  await call('desk_select',{ids:[]});assert.equal((await add()).seriesId,first.seriesId);
  await page.locator('#numbering').focus();await page.keyboard.press('Enter');assert.equal((await call('desk_get',{id:(await call('desk_selection')).ids[0]})).seriesId,first.seriesId);
  await page.setViewportSize({width:390,height:900});await page.locator('#pin-series-menu').click();assert.ok(await page.locator('#pin-series-palette').evaluate(node=>{const r=node.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth}));
  assert.deepEqual(errors,[]);
 }finally{await close();}
});
