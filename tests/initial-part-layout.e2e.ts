import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openTestDesk} from './desk-browser';

test('human creation and external paste use readable sizes centered in the panned/zoomed viewport', {timeout:45000},async()=>{
 const {page,call,close,errors}=await openTestDesk('initial-part-layout');
 const near=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<.1,`${actual} != ${expected}`);
 try{
  await call('desk_execute',{operations:[{kind:'grid_update',patch:{enabled:false}}]});
  await call('desk_camera_move',{center:{x:2400,y:-1800},zoom:.5,durationMs:0});
  const camera=await call('desk_camera_get');
  await page.getByRole('button',{name:'図形の候補',exact:true}).click();
  await page.getByRole('dialog',{name:'図形の候補',exact:true}).getByRole('button',{name:'矩形',exact:true}).click();
  let objects=(await call('desk_list')).objects;const shape=objects.at(-1);
  assert.equal(shape.width,368);assert.equal(shape.height,192);near(shape.x+shape.width/2,camera.center.x);near(shape.y+shape.height/2,camera.center.y);
  await page.getByRole('button',{name:'テキスト',exact:true}).click();
  await page.locator('[data-inline-text]').fill('New note');await page.locator('[data-inline-text]').press('Enter');
  const note=(await call('desk_list')).objects.at(-1);assert.equal(note.width,744);assert.equal(note.height,480);
  near(note.x+note.width/2,camera.center.x+22);near(note.y+note.height/2,camera.center.y+22);
  const paste=async(text:string)=>page.evaluate(text=>document.querySelector('#canvas')!.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,clipboardData:(()=>{const data=new DataTransfer();data.setData('text/plain',text);return data;})()})),text);
  await paste('External memo');const pasted=(await call('desk_list')).objects.at(-1);
  assert.equal(pasted.width,744);assert.equal(pasted.height,480);near(pasted.x+pasted.width/2,camera.center.x);near(pasted.y+pasted.height/2,camera.center.y);
  await paste('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="red"/></svg>');
  await page.waitForFunction(()=>!!document.querySelector('[data-id^="image-"]'));
  const image=(await call('desk_list')).objects.at(-1);assert.equal(image.width,368);assert.equal(image.height,218);
  near(image.x+image.width/2,camera.center.x);near(image.y+image.height/2,camera.center.y);
  await call('desk_select',{ids:[]});
  await page.getByRole('button',{name:'線',exact:true}).click();
  const line=(await call('desk_list')).objects.at(-1);near(line.x2-line.x,300);near(line.y2-line.y,168);
  const offset=4%8*22;near((line.x+line.x2)/2,camera.center.x+offset);near((line.y+line.y2)/2,camera.center.y+offset);
  assert.deepEqual(errors,[]);
 }finally{await close();}
});
