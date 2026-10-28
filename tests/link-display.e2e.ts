import assert from 'node:assert/strict';
import {test} from 'node:test';
import {openTestDesk} from './desk-browser';

test('link display buttons switch URL/QR, retain geometry and scale both URL text and chain',{timeout:60000},async()=>{
 const {page,call,close,errors}=await openTestDesk('link-display');
 try{
  const url='https://example.com/articles/long-url?key=value&other=日本語';
  await call('desk_execute',{operations:[{kind:'add',object:{id:'link',type:'link',x:100,y:100,width:600,height:340,text:'参考資料',url,fontSize:32,fill:'#dcfce7',fillOpacity:0.4,stroke:'#15803d',strokeWidth:5,stickers:{items:[{color:'#ff0000',shape:'circle'}],diameter:36,origin:'top-right',fixed:false}}}]});
  await call('desk_select',{ids:['link']});const group=page.locator('[data-id="link"]');
  assert.equal(await group.getAttribute('data-link-display'),'url');assert.equal(await group.locator('[data-link-header-icon]').count(),1);
  assert.equal(await group.locator('[data-link-url-text]').textContent(),url);assert.equal(await group.locator('[data-link-body-icon]').getAttribute('width'),'32');
  assert.equal(await group.locator(':scope > rect').first().getAttribute('fill'),'#dcfce7');
  assert.equal(await group.locator(':scope > rect').first().getAttribute('stroke-width'),'5');
  const font=page.locator('#properties [name=fontSize]');await font.fill('48');await font.blur();
  assert.equal(await group.locator('[data-link-body-icon]').getAttribute('width'),'48');
  assert.equal(await group.locator('[data-link-url-text]').evaluate(el=>getComputedStyle(el.parentElement!).fontSize),'48px');
  await page.screenshot({path:'/tmp/tabletop-link-url.png'});
  const before=await call('desk_get',{id:'link'});
  await page.locator('[data-link-display="qr"]').click();await page.locator('[data-id="link"][data-qr-status="ready"]').waitFor();
  assert.equal(await group.locator('[data-link-url-content]').count(),0);assert.equal(await group.locator('[data-link-header-icon]').count(),1);
  assert.equal(await page.locator('#properties [name=fontSize]').isVisible(),false);
  assert.equal(await group.locator(':scope > rect').first().getAttribute('fill'),'#ffffff');
  assert.equal(await group.locator('.qr-image').getAttribute('y'),'70');
  assert.equal(await group.locator('.qr-image').getAttribute('height'),'234');
  const exported=await call('desk_asset_read',{id:'link'});assert.equal(exported.qrText,url);assert.equal(exported.status,'ready');
  const after=await call('desk_get',{id:'link'});for(const key of ['x','y','width','height','url','fontSize'])assert.equal(after[key],before[key]);
  const popupPromise=page.waitForEvent('popup');await page.locator('#file-menu').click();await page.locator('#open-desk-pdf').click();const popup=await popupPromise;await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.includes('のPDFを開きました'));await popup.close();
  const changed='https://example.org/new';const input=page.locator('#properties [name=url]');await input.fill(changed);await input.blur();
  await page.locator('[data-id="link"][data-qr-status="ready"]').waitFor();assert.equal((await call('desk_asset_read',{id:'link'})).qrText,changed);
  assert.equal(await group.locator('[data-open-url]').getAttribute('href'),changed);
  await page.screenshot({path:'/tmp/tabletop-link-qr.png'});
  await page.locator('[data-link-display="url"]').click();assert.equal(await group.locator('[data-link-url-text]').textContent(),changed);assert.equal(await font.inputValue(),'48');
  assert.equal(await group.locator(':scope > rect').first().getAttribute('fill'),'#dcfce7');
  const urlPdfPromise=page.waitForEvent('popup');await page.locator('#file-menu').click();await page.locator('#open-desk-pdf').click();const urlPdf=await urlPdfPromise;await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.includes('のPDFを開きました'));await urlPdf.close();
  await call('desk_undo');await page.locator('[data-id="link"][data-qr-status="ready"]').waitFor();
  await call('desk_execute',{operations:[{kind:'add',object:{id:'desk-ref',type:'link',deskPath:'/tmp/test.tabletop',x:800,y:100,width:250,height:200}}]});
  await call('desk_select',{ids:['desk-ref']});assert.equal(await page.locator('[data-link-display="url"]').isVisible(),false);
  assert.equal(await page.locator('[data-id="desk-ref"] [data-desk-link-icon]').count(),1);assert.equal(await page.locator('[data-id="desk-ref"] [data-link-header-icon]').count(),0);
  assert.deepEqual(errors,[]);
 }finally{await close();}
});
