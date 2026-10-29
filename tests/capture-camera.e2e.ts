import test from 'node:test';
import assert from 'node:assert/strict';
import {openTestDesk} from './desk-browser';
const clipboard=`window.__capture=null;window.__captureFail=false;Object.defineProperty(navigator,'clipboard',{value:{write:async items=>{if(window.__captureFail)throw new Error('Permission denied');const blob=await items[0].getType('image/png');const image=await createImageBitmap(blob);const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);window.__capture={width:image.width,height:image.height,center:Array.from(ctx.getImageData(Math.floor(image.width/2),Math.floor(image.height/2),1,1).data)};}}});`;
test('camera uses adjustable selection crop, PNG and remembered transient range without scene edits',{timeout:60000},async()=>{
 const {page,call,close,errors}=await openTestDesk('capture-camera',clipboard);
 try{
  await page.locator('#camera-capture').click();
  assert.equal(await page.locator('#capture-copy').isDisabled(),true);
  const surface=await page.locator('#capture-surface').boundingBox();assert.ok(surface);
  await page.mouse.move(surface.x+100,surface.y+100);await page.mouse.down();await page.mouse.move(surface.x+400,surface.y+300);await page.mouse.up();
  assert.equal(await page.locator('#capture-copy').isEnabled(),true);
  await page.keyboard.press('Escape');
  await call('desk_execute',{operations:[{kind:'add',object:{id:'red',type:'rect',x:0,y:0,width:400,height:300,fill:'#ff0000',fillOpacity:1,stroke:'transparent'}}]});
  await call('desk_select',{ids:['red']});await call('desk_camera_move',{center:{x:200,y:150},zoom:.5,durationMs:0});
  const before=await call('desk_summary');
  await page.locator('#camera-capture').click();await page.locator('#capture-copy').click();
  await page.waitForFunction(()=>!!(window as any).__capture);
  assert.deepEqual(await page.evaluate(()=>(window as any).__capture),{width:400,height:300,center:[255,0,0,255]});
  assert.equal((await call('desk_summary')).revision,before.revision);
  assert.deepEqual((await call('desk_selection')).ids,['red']);
  await call('desk_select',{ids:[]});await page.locator('#camera-capture').click();
  assert.equal(await page.locator('#capture-frame').getAttribute('width'),'200');
  await page.keyboard.press('Escape');assert.equal(await page.locator('#capture-camera').isVisible(),false);
  await page.locator('#camera-capture').click();
  const handle=await page.locator('[data-corner=se]').boundingBox();assert.ok(handle);
  await page.mouse.move(handle.x+6,handle.y+6);await page.mouse.down();await page.mouse.move(handle.x+56,handle.y+56);await page.mouse.up();
  await page.evaluate(()=>{(window as any).__captureFail=true;});await page.locator('#capture-copy').click();
  await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.includes('画像コピーに失敗'));
  assert.equal(await page.locator('#capture-camera').isVisible(),true);
  await page.evaluate(()=>{(window as any).__captureFail=false;(window as any).__capture=null;});await page.locator('#capture-copy').click();
  await page.waitForFunction(()=>!!(window as any).__capture);
  const resizedWidth=await page.evaluate(()=>(window as any).__capture.width);assert.ok(Math.abs(resizedWidth-500)<=2);
  assert.equal((await call('desk_summary')).revision,before.revision);
  assert.deepEqual(errors,[]);
 }finally{await close();}
});
