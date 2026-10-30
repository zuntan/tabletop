import {test} from 'node:test';
import assert from 'node:assert/strict';
import {doodleSvg,emptyDoodle} from '../src/doodle-values';
import {openTestDesk} from './desk-browser';
test('doodle local history, editing, paper resize and cancellation preserve the shared desk',{timeout:60000},async()=>{
 const {page,call,close,errors,client}=await openTestDesk('doodle');try{
 await page.locator('#doodle-create').click();let state=await call('desk_list');const objects=Array.isArray(state)?state:state.objects;const object=objects.find((o:any)=>o.doodle);assert.ok(object);
 assert.equal(await page.locator(`[data-id="${object.id}"] [data-doodle-frame]`).getAttribute('fill'),'transparent');
 assert.equal(await page.locator(`[data-id="${object.id}"] [data-doodle-title]`).getAttribute('fill'),'#ffffff');
 const overlay=await page.evaluate(async ({id,width,height})=>{
  const group=document.querySelector(`[data-id="${id}"]`)!.cloneNode(true) as Element;group.removeAttribute('transform');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#00ff00"/>${new XMLSerializer().serializeToString(group)}</svg>`;
  const image=new Image();image.src='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svg)));await image.decode();const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);return [[10,60],[10,10]].map(([x,y])=>Array.from(ctx.getImageData(x,y,1,1).data));
 },{id:object.id,width:object.width,height:object.height});assert.deepEqual(overlay,[[0,255,0,255],[255,255,255,255]]);
 await call('desk_camera_move',{center:{x:object.x+object.width/2,y:object.y+object.height/2},zoom:1,durationMs:0});
 await page.locator(`[data-id="${object.id}"]`).dblclick({position:{x:60,y:70}});await page.locator('#doodle-editor').waitFor();
 const blocked=await client.callTool({name:'desk_undo',arguments:{deskId:await page.locator('#desk-id').textContent()}});assert.equal(blocked.isError,true);
 assert.equal(await page.locator('[data-doodle-tool=pen] svg').count(),1);assert.equal(await page.locator('[data-doodle-tool=eraser] svg').count(),1);
 assert.equal(await page.locator('[data-doodle-size-slot]').count(),3);
 assert.equal(await page.locator('#doodle-surface>rect').getAttribute('fill'),'url(#doodle-transparency-grid)');
 await page.getByRole('button',{name:'太さ3を変更',exact:true}).click();await page.locator('.doodle-size-menu:popover-open [data-doodle-size-choice="64"]').click();
 assert.equal(await page.locator('[data-doodle-size-slot="2"]').textContent(),'64');
 const surface=page.locator('#doodle-surface'),box=(await surface.boundingBox())!;
 await page.mouse.move(box.x+box.width/2-50,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+60,box.y+box.height/2+40,{steps:12});await page.mouse.up();
 await surface.press('Control+z');assert.equal((await call('desk_get',{id:object.id})).doodle.strokes.length,0);
 await page.locator('#doodle-redo').click();
 await page.locator('[data-color-role="doodle-stroke"]').click();await page.locator('.palette-doodle-stroke').getByRole('button',{name:'全色',exact:true}).click();await page.locator('.palette-doodle-stroke .pcr-swatches button').nth(7).click();
 await page.screenshot({path:'/tmp/tabletop-doodle-editor.png'});await page.locator('#doodle-accept').click();let saved=await call('desk_get',{id:object.id});assert.equal(saved.doodle.strokes.length,1);assert.equal(saved.doodle.strokes[0].width,64);const points=saved.doodle.strokes[0].points;
 await call('desk_execute',{operations:[{kind:'update',id:object.id,patch:{width:200,height:180}}]});saved=await call('desk_get',{id:object.id});assert.deepEqual(saved.doodle.strokes[0].points,points);
 await page.locator(`[data-id="${object.id}"]`).dblclick({position:{x:40,y:65}});assert.equal(await page.locator('[data-doodle-size-slot="2"]').textContent(),'64');await page.getByRole('button',{name:'全消去',exact:true}).click();await page.getByRole('button',{name:'キャンセル',exact:true}).click();assert.deepEqual((await call('desk_get',{id:object.id})).doodle.strokes[0].points,points);
 await call('desk_undo');assert.equal((await call('desk_get',{id:object.id})).width,object.width);await call('desk_undo');assert.equal((await call('desk_get',{id:object.id})).doodle.strokes.length,0);const drawing=emptyDoodle();drawing.strokes=[
 {tool:'pen',color:'#ff0000',width:12,points:[{x:10,y:50},{x:90,y:50}]},
 {tool:'eraser',color:'#000000',width:20,points:[{x:50,y:10},{x:50,y:90}]},
 {tool:'pen',color:'#0000ff',width:4,points:[{x:45,y:50},{x:55,y:50}]}];
 const samples=await page.evaluate(async svg=>{const image=new Image();image.src='data:image/svg+xml;base64,'+btoa(svg);await image.decode();const c=document.createElement('canvas');c.width=c.height=100;const ctx=c.getContext('2d')!;ctx.drawImage(image,0,0);return [[20,50],[50,30],[50,50]].map(([x,y])=>Array.from(ctx.getImageData(x,y,1,1).data));},doodleSvg(drawing,100,100));
 assert.deepEqual(samples,[[255,0,0,255],[0,0,0,0],[0,0,255,255]]);assert.deepEqual(errors,[]);
 }finally{await close();}
});
