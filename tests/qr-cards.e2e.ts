import assert from 'node:assert/strict';
import {test} from 'node:test';
import {openTestDesk} from './desk-browser';

test('QR toolbar/editor render verbatim text, export SVG and recover overflow without external requests',{timeout:60000},async()=>{
 const {page,call,close,errors}=await openTestDesk('qr-cards');page.setDefaultTimeout(15000);
 const external:string[]=[];await page.route('**/*',route=>{if(/^https?:/.test(route.request().url())&&!route.request().url().startsWith('http://127.0.0.1:')){external.push(route.request().url());return route.abort();}return route.continue();});
 try{
  await page.getByRole('button',{name:'QRコード',exact:true}).click();
  const input=page.locator('[data-inline-qr]'),source='  スマホへ渡す\nhttps://example.com/  ';
  await input.fill(source);await input.press('Control+Enter');
  const context=await call('desk_context'),q=context.objects.find((o:any)=>o.type==='qrcode');assert.ok(q);assert.equal(q.qrText,source);
  const group=page.locator(`[data-id="${q.id}"][data-qr-status="ready"]`);await group.waitFor();
  assert.equal(await group.locator('image').getAttribute('preserveAspectRatio'),'xMidYMid meet');
  const original=await call('desk_asset_read',{id:q.id});assert.equal(original.qrText,source);assert.equal(original.status,'ready');assert.match(original.svg,/<svg/);
  assert.equal(await group.locator('.qr-image').evaluate(async el=>{const image=new Image();image.src=el.getAttribute('href')!;await image.decode();return image.naturalWidth>0;}),true);
  await call('desk_select',{ids:[q.id]});const property=page.locator('#properties textarea[name="qrText"]');assert.equal(await property.inputValue(),source);
  await property.fill('あ'.repeat(1000));await property.blur();await page.locator(`[data-id="${q.id}"][data-qr-status="too-long"]`).waitFor();
  const failed=await call('desk_asset_read',{id:q.id});assert.match(failed.svg,/長すぎます<\/text>/);assert.equal(failed.qrText,'あ'.repeat(1000));
  await page.screenshot({path:'/tmp/tabletop-qr-overflow.png'});
  await property.fill('短くしました');await property.blur();await group.waitFor();
  await call('desk_undo');await page.locator(`[data-id="${q.id}"][data-qr-status="too-long"]`).waitFor();await call('desk_redo');await group.waitFor();
  await page.locator(`[data-id="${q.id}"]`).dblclick({position:{x:40,y:15}});await input.waitFor();assert.equal(await input.inputValue(),'短くしました');await input.press('Escape');
  await call('desk_execute',{operations:[{kind:'update',id:q.id,patch:{width:500,height:220}}]});await group.waitFor();
  await page.screenshot({path:'/tmp/tabletop-qr-ready.png'});
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 }finally{await close();}
});

test('QR media opens separately, exports PDF and survives animated deletion Undo',{timeout:60000},async()=>{
 const capture=`window.__pdfBlob=null;const original=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{if(blob.type==='application/pdf')window.__pdfBlob=blob;return original(blob);};`;
 const {page,call,close,errors}=await openTestDesk('qr-outputs',capture);
 try{
  await call('desk_execute',{operations:[{kind:'add',object:{id:'q',type:'qrcode',x:100,y:100,width:300,height:334,text:'スマホへ',qrText:'https://example.com/'}},{kind:'add',object:{id:'line',type:'line',startBinding:{objectId:'q',anchor:'right'},x2:700,y2:200}}]});
  await page.locator('[data-id="q"][data-qr-status="ready"]').waitFor();
  const mediaPromise=page.waitForEvent('popup');await page.locator('[data-open-media="q"]').click();const media=await mediaPromise;
  await media.waitForFunction(()=>document.querySelector('img')?.complete&&document.querySelector('img')!.naturalWidth>0);await media.close();
  const revision=(await call('desk_summary')).revision;
  await page.locator('#file-menu').click();const pdfPromise=page.waitForEvent('popup');await page.locator('#open-desk-pdf').click();const pdf=await pdfPromise;
  await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.includes('のPDFを開きました'));
  assert.equal(await page.evaluate(()=>!!(window as any).__pdfBlob),true);assert.equal((await call('desk_summary')).revision,revision);await pdf.close();
  await call('desk_select',{ids:['q']});await page.locator('#delete').click();await page.locator('#bh-delete-overlay').waitFor();
  assert.equal((await call('desk_summary')).count,1);assert.equal((await call('desk_get',{id:'line'})).startBinding,null);
  await call('desk_undo');await page.waitForFunction(()=>!document.querySelector('#bh-delete-overlay'));await page.locator('[data-id="q"][data-qr-status="ready"]').waitFor();
  assert.equal((await call('desk_get',{id:'line'})).startBinding.objectId,'q');assert.deepEqual(errors,[]);
 }finally{await close();}
});
