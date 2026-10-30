import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openTestDesk} from './desk-browser';

test('stamp date preference survives a new desk at the same browser origin',{timeout:45000},async()=>{
 const name='stamp-date-local';const {page,call,close,port,errors}=await openTestDesk(name);
 try{
  assert.equal(await page.locator('#stamp-dated').isChecked(),false);
  await page.locator('#stamp-menu').click();await page.locator('#stamp-dated').check();
  assert.equal(await page.evaluate(()=>localStorage.getItem('tabletop.stamp.dated')),'true');
  await call('desk_pairing_open',{confirm:true});
  await page.goto('about:blank');await page.goto(`http://127.0.0.1:${port}/#token=${name}-012345678901234567890123456789&port=${port}`);
  await page.waitForFunction(()=>document.querySelector('#connection')?.textContent==='MCP接続済み');
  assert.equal(await page.locator('#stamp-dated').isChecked(),true);
  await call('desk_execute',{operations:[{kind:'add',object:{id:'note',type:'text',text:'日付'}}]});await call('desk_select',{ids:['note']});
  await page.locator('#stamp-open').click();assert.match((await call('desk_get',{id:'note'})).stamp.text,/^\d{4}\.\d{2}\.\d{2}$/);
  await page.locator('#stamp-menu').click();await page.locator('#stamp-dated').uncheck();
  assert.equal(await page.evaluate(()=>localStorage.getItem('tabletop.stamp.dated')),'false');assert.deepEqual(errors,[]);
 }finally{await close();}
});
