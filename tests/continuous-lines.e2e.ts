import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {openTestDesk} from './desk-browser';

test('click line input creates joined editable segments, closes loops, supports Undo and resumes from an endpoint',{timeout:60_000},async()=>{
 const {page,call,close,errors}=await openTestDesk('continuous-lines');
 const start=async(name='連続線')=>{await page.locator('#line-input-open').click();await page.getByRole('menu',{name:'線の入力方法'}).getByRole('menuitem',{name,exact:true}).click();};
 const point=async(x:number,y:number)=>page.locator('#viewport').evaluate((v,p)=>{const q=new DOMPoint(p.x,p.y).matrixTransform((v as unknown as SVGGraphicsElement).getScreenCTM()!);return{x:q.x,y:q.y};},{x,y});
 const click=async(x:number,y:number)=>{const p=await point(x,y);await page.mouse.click(p.x,p.y);};
 try{
  await call('desk_execute',{operations:[{kind:'grid_update',patch:{enabled:false}}]});await call('desk_camera_move',{center:{x:250,y:200},zoom:1,durationMs:0});
  await start();await click(100,100);assert.equal((await call('desk_summary')).count,0);await click(300,100);await click(300,300);assert.equal((await call('desk_summary')).count,2);await page.keyboard.press('Escape');
  let state=await call('desk_state');const lines=state.objects;assert.equal(lines[0].endJunction,lines[1].startJunction);assert.equal((await call('desk_selection')).ids.length,2);assert.equal(await page.locator('#canvas').getAttribute('data-line-input'),null);
  await start();await click(300,300);await click(450,300);assert.equal((await call('desk_summary')).count,3);
  await page.keyboard.press('Control+z');assert.equal((await call('desk_summary')).count,2);await page.keyboard.press('Control+Shift+z');assert.equal((await call('desk_summary')).count,3);await page.keyboard.press('Enter');state=await call('desk_state');assert.equal(state.objects[1].endJunction,state.objects[2].startJunction);
  await start();await click(-100,-100);await click(-100,50);await click(50,50);await click(-100,-100);assert.equal(await page.locator('#canvas').getAttribute('data-line-input'),null);state=await call('desk_state');assert.equal(state.objects.length,6);assert.equal(state.objects[3].startJunction,state.objects[5].endJunction);
  await start();await click(200,400);await click(350,400);await page.locator('[data-add="rect"]').click();assert.equal(await page.locator('#canvas').getAttribute('data-line-input'),null);assert.equal((await call('desk_state')).objects.filter((o:any)=>o.type==='line').length,7);
  await mkdir('tmp/continuous-lines',{recursive:true});await page.screenshot({path:'tmp/continuous-lines/clicks.png'});assert.deepEqual(errors,[]);
 }finally{await close();}
});

test('free line input cleans a gesture into few segments and undoes the entire stroke; taps and cancellation create nothing',{timeout:60_000},async()=>{
 const {page,call,close,errors}=await openTestDesk('free-continuous-lines');
 const start=async()=>{await page.locator('#line-input-open').click();await page.getByRole('menuitem',{name:'フリー連続線',exact:true}).click();};
 try{
  await call('desk_execute',{operations:[{kind:'grid_update',patch:{enabled:false}}]});
  const box=await page.locator('#canvas').boundingBox();assert.ok(box);const x=box.x+130,y=box.y+120;
  await start();await page.mouse.move(x,y);await page.mouse.down();for(let i=1;i<=40;i++)await page.mouse.move(x+i*6,y+Math.sin(i)*1.5);for(let i=1;i<=30;i++)await page.mouse.move(x+240+Math.sin(i)*1.5,y+i*6);await page.mouse.up();
  const state=await call('desk_state');assert.ok(state.objects.length>=2&&state.objects.length<=4);assert.ok(state.objects.every((o:any)=>o.type==='line'&&o.junctionRounding===48));assert.equal((await call('desk_selection')).ids.length,state.objects.length);
  await page.keyboard.press('Control+z');assert.equal((await call('desk_summary')).count,0);await page.keyboard.press('Control+Shift+z');assert.equal((await call('desk_summary')).count,state.objects.length);
  const count=state.objects.length;await start();await page.mouse.click(x+350,y);assert.equal((await call('desk_summary')).count,count);
  await start();await page.mouse.move(x+350,y);await page.mouse.down();await page.mouse.move(x+450,y+100,{steps:12});await page.keyboard.press('Escape');await page.mouse.up();assert.equal((await call('desk_summary')).count,count);assert.equal(await page.locator('[data-line-input-preview] polyline').count(),0);
  await page.screenshot({path:'tmp/continuous-lines/free.png'});assert.deepEqual(errors,[]);
 }finally{await close();}
});
