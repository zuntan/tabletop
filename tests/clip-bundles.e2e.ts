import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDesk } from './desk-browser';

test('clip shortcuts, properties, dragging/peeling, appending, filtering, deletion and Undo work on the shared desk', {timeout:90_000},async()=>{
 const {page,call,close,errors}=await openTestDesk('clip-bundles');page.setDefaultTimeout(8000);
 try {
  await call('desk_execute',{operations:[{kind:'grid_update',patch:{enabled:false}},
   ...['a','b','c'].map((id,i)=>({kind:'add',object:{id,type:'text',x:200+i*220,y:120,width:300,height:180,text:id}})),
   {kind:'add',object:{id:'arrow',type:'line',x:50,y:500,x2:200,y2:500}},
  ]});
  await call('desk_select',{ids:['a','b','arrow','c']});await page.locator('#canvas').focus();await page.keyboard.press('Control+g');
  let state=await call('desk_state'),clip=state.objects.find((o:{type:string})=>o.type==='clip');assert.ok(clip);const id=clip.id;
  assert.deepEqual(clip.clipMembers,['a','b','c']);assert.deepEqual(state.objects.filter((o:{id:string})=>o.id!=='arrow').map((o:{id:string})=>o.id),['a','b','c',id]);
  assert.equal(await page.locator('[name="clipOffset"]').inputValue(),'32');
  assert.equal(await page.locator(`[data-id="${id}"] .tabletop-binder-body`).evaluate(el=>el.namespaceURI),'http://www.w3.org/2000/svg');
  assert.equal(await page.locator(`[data-id="${id}"] .tabletop-binder-body`).evaluate(el=>getComputedStyle(el).fill),'rgb(38, 49, 61)');
  await page.locator('[name="clipOffset"]').fill('0');await page.locator('[name="clipOffset"]').press('Enter');
  assert.equal((await call('desk_get',{id:'b'})).x,(await call('desk_get',{id:'a'})).x);
  await page.locator('[name="clipOffset"]').fill('80');await page.locator('[name="clipOffset"]').press('Enter');
  const offsetInput=page.locator('[name="clipSize"]');await offsetInput.fill('96');await offsetInput.press('Enter');assert.equal((await call('desk_get',{id})).clipSize,96);
  async function drag(objectId:string,dx:number,dy:number,alt=false,top=false){
   const o=await call('desk_get',{id:objectId});
   const p=await page.locator('#viewport').evaluate((el,{x,y})=>{const p=new DOMPoint(x,y).matrixTransform((el as unknown as SVGGraphicsElement).getScreenCTM()!);return{x:p.x,y:p.y};},{x:o.x+o.width*.6,y:o.y+(top?4:o.height*.6)});
   if(alt)await page.keyboard.down('Alt');await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+dx,p.y+dy,{steps:8});await page.mouse.up();if(alt)await page.keyboard.up('Alt');
  }
  await page.locator('#mouse-lock').click();
  assert.ok((await call('desk_state')).objects.filter((o:{id:string})=>['a','b','c',id].includes(o.id)).every((o:{locked:boolean})=>o.locked));
  const lockedA=await call('desk_get',{id:'a'});await drag('c',40,30);assert.equal((await call('desk_get',{id:'a'})).x,lockedA.x);
  await call('desk_select',{ids:['b']});await page.locator('#canvas').focus();await page.keyboard.press('Control+Shift+g');assert.ok(await call('desk_get',{id}));
  await page.locator('#property-lock').click();assert.ok((await call('desk_state')).objects.filter((o:{id:string})=>['a','b','c',id].includes(o.id)).every((o:{locked:boolean})=>!o.locked));
  await page.locator('#canvas').focus();const a=await call('desk_get',{id:'a'});await drag('c',40,30);assert.equal((await call('desk_get',{id:'a'})).x,a.x+40);
  const c=await call('desk_get',{id:'c'});await drag('c',140,100,true);assert.deepEqual((await call('desk_get',{id})).clipMembers,['a','b']);assert.equal((await call('desk_get',{id:'c'})).x,c.x+140);
  const b=await call('desk_get',{id:'b'});await drag('a',-80,70,true,true);assert.deepEqual((await call('desk_get',{id})).clipMembers,['b']);assert.equal((await call('desk_get',{id:'b'})).x,b.x);
  await call('desk_execute',{operations:[{kind:'add',object:{id:'d',type:'text',x:650,y:350,width:180,height:120,text:'new paper'}}]});
  clip=await call('desk_get',{id});const d=await call('desk_get',{id:'d'});await drag('d',(clip.x+clip.width/2)-(d.x+d.width*.6),(clip.y+clip.height/2)-(d.y+d.height*.6));
  assert.deepEqual((await call('desk_get',{id})).clipMembers,['b','d']);
  // The clip category includes its papers even with all other categories disabled.
  await page.getByRole('tab',{name:'オブジェクト',exact:true}).click();await page.locator('#object-filter-all-off').click();await page.locator('#object-filter-clips').click();
  if(await page.locator('#object-filter-apply').getAttribute('aria-checked')!=='true')await page.locator('#object-filter-apply').click();
  const rows=await page.locator('#object-list .object-row').allTextContents();assert.equal(rows.length,3);assert.ok(rows[0].includes('クリップ'));
  await call('desk_select',{ids:['d']});await page.locator('#canvas').focus();await page.keyboard.press('Delete');assert.equal((await call('desk_state')).objects.some((o:{id:string})=>o.id===id),false);
  await call('desk_undo');assert.deepEqual((await call('desk_get',{id})).clipMembers,['b','d']);
  await call('desk_select',{ids:['b']});await page.locator('#canvas').focus();await page.keyboard.press('Control+Shift+g');assert.equal((await call('desk_state')).objects.some((o:{id:string})=>o.id===id),false);
  assert.deepEqual(errors,[]);
 } finally {await close();}
});
