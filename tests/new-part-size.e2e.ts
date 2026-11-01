import test from 'node:test';
import assert from 'node:assert/strict';
import {openTestDesk} from './desk-browser';
test('human creation and editor commit snap sizes; pasted text preserves its initial size',{timeout:30000},async()=>{
 const d=await openTestDesk('new-part-size');const {page,call}=d;
 try{
  await call('desk_execute',{operations:[{kind:'grid_update',patch:{enabled:true,interval:120,snapDivisions:1}}]});
  await page.getByRole('button',{name:'図形の候補',exact:true}).click();await page.getByRole('dialog',{name:'図形の候補',exact:true}).getByRole('button',{name:'矩形',exact:true}).click();
  const rect=(await call('desk_list')).objects.at(-1);assert.deepEqual([rect.width,rect.height],[480,240]);assert.equal(rect.x%120,0);assert.equal(rect.y%120,0);
  await page.locator('[data-add="text"]').click();await page.locator('[data-inline-text]').fill('grid card');await page.locator('[data-inline-text]').press('Control+Enter');
  const note=(await call('desk_list')).objects.at(-1);assert.deepEqual([note.width,note.height],[840,480]);assert.equal(note.x%120,0);assert.equal(note.y%120,0);
  await page.locator('#canvas').focus();await page.evaluate(()=>{const data=new DataTransfer();data.setData('text/plain','external text');window.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));});
  await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.includes('カードを貼り付けました'));
  const pasted=(await call('desk_list')).objects.at(-1);assert.deepEqual([pasted.width,pasted.height],[744,480]);
  await page.locator('#file').setInputFiles({name:'sample.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><rect width="80" height="40"/></svg>')});
  await page.waitForFunction(()=>!!document.querySelector('#objects [data-id^="image-"]'));
  const media=(await call('desk_list')).objects.at(-1);assert.equal(media.type,'svg');assert.deepEqual([media.width,media.height],[480,240]);assert.equal(await page.locator(`[data-id="${media.id}"] image`).getAttribute('preserveAspectRatio'),'xMidYMid meet');
  await call('desk_execute',{operations:[{kind:'update',id:media.id,patch:{width:373,height:227}}]});await call('desk_select',{ids:[media.id]});await page.locator('#canvas').focus();
  await page.evaluate(()=>{const data=new DataTransfer();window.dispatchEvent(new ClipboardEvent('copy',{clipboardData:data,bubbles:true,cancelable:true}));window.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));});
  const copy=(await call('desk_list')).objects.at(-1);assert.notEqual(copy.id,media.id);assert.deepEqual([copy.width,copy.height],[373,227]);assert.deepEqual(d.errors,[]);
 }finally{await d.close();}
});
