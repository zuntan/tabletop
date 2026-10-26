import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {openTestDesk} from './desk-browser';

test('ruler toolbar, properties, two-sided drop, constrained drag, Alt peel, file freeze and material rendering',{timeout:60_000},async()=>{
 const {page,call,close,errors}=await openTestDesk('ruler-layout');
 const move=async(id:string,dx:number,dy:number,alt=false)=>{
  const p=await page.locator(`[data-id="${id}"]`).evaluate(g=>{const b=(g as unknown as SVGGraphicsElement).getBBox(),m=(g as unknown as SVGGraphicsElement).getScreenCTM()!;const p=new DOMPoint(b.x+Math.min(20,b.width/2),b.y+Math.min(30,b.height/2)).matrixTransform(m);return{x:p.x,y:p.y};});
  if(alt)await page.keyboard.down('Alt');await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+dx,p.y+dy,{steps:6});await page.mouse.up();if(alt)await page.keyboard.up('Alt');
 };
 try{
  assert.equal(await page.locator('#file-create + #ruler-create').count(),1);assert.equal(await page.locator('#ruler-create [data-icon="ruler-2"]').count(),1);
  await call('desk_execute',{operations:[{kind:'grid_update',patch:{enabled:false}},
   {kind:'add',object:{id:'a',type:'text',x:250,y:100,width:220,height:130,text:'最初のカード'}},
   {kind:'add',object:{id:'b',type:'rect',x:250,y:300,width:220,height:160,text:'図形も配置'}},
   {kind:'add',object:{id:'extra',type:'text',x:650,y:100,width:180,height:100,text:'反対側へ'}}
  ]});await call('desk_select',{ids:['a','b']});await page.locator('#ruler-create').click();
  const state=await call('desk_state'),r=state.objects.find((o:any)=>o.type==='ruler');assert.ok(r);assert.equal(r.rulerMembers.length,2);
  await page.getByRole('button',{name:'配置方式の候補',exact:true}).click();await page.getByRole('dialog',{name:'配置方式の候補',exact:true}).getByRole('button',{name:'均等',exact:true}).click();assert.equal((await call('desk_get',{id:r.id})).rulerMode,'gap');
  await page.getByRole('button',{name:'定規の素材の候補',exact:true}).click();await page.getByRole('dialog',{name:'定規の素材の候補',exact:true}).getByRole('button',{name:'竹',exact:true}).click();assert.equal((await call('desk_get',{id:r.id})).rulerMaterial,'bamboo');
  await call('desk_camera_move',{center:{x:400,y:300},zoom:1,durationMs:0});
  // Move a free card to the before edge. Pointer ends on the ruler's left edge.
  const extra=await call('desk_get',{id:'extra'});await move('extra',r.x-(extra.x+20),r.y+200-(extra.y+30));
  assert.equal((await call('desk_get',{id:r.id})).rulerMembers.find((m:any)=>m.id==='extra').side,'before');assert.equal((await call('desk_get',{id:'extra'})).x,r.x-extra.width);
  await call('desk_execute',{operations:[{kind:'update',id:r.id,patch:{rulerMode:'free'}}]});const before=await call('desk_get',{id:'a'});await move('a',50,40);const after=await call('desk_get',{id:'a'});assert.equal(after.x,before.x);assert.equal(after.y,before.y+40);
  await move('a',90,0,true);assert.equal((await call('desk_get',{id:r.id})).rulerMembers.some((m:any)=>m.id==='a'),false);await call('desk_undo');
  await call('desk_execute',{operations:[{kind:'update',id:r.id,patch:{rulerMode:'center'}}]});await call('desk_select',{ids:[r.id]});await page.locator('#file-create').click();const f=(await call('desk_state')).objects.find((o:any)=>o.type==='file');assert.equal(f.fileMembers.length,4);
  await call('desk_select',{ids:[r.id]});assert.equal(await page.getByRole('button',{name:'定規の素材の候補',exact:true}).isDisabled(),true);assert.equal(await page.locator('[data-resize="'+r.id+'"]').count(),0);
  await call('desk_execute',{operations:[{kind:'delete',id:f.id}]});
  await call('desk_execute',{operations:[{kind:'add',object:{id:'steel',type:'ruler',x:650,y:90,width:500,height:36,rulerMaterial:'steel'}},{kind:'add',object:{id:'acrylic',type:'ruler',x:650,y:190,width:500,height:36,rulerMaterial:'acrylic'}}]});
  await call('desk_select',{ids:[]});await call('desk_camera_move',{center:{x:600,y:300},zoom:.8,durationMs:0});
  assert.equal(await page.locator('[data-ruler-body]').count(),3);assert.equal(await page.locator('[data-ruler-body] pattern').count(),3);
  await mkdir('tmp/rulers',{recursive:true});await page.screenshot({path:'tmp/rulers/materials.png'});assert.deepEqual(errors,[]);
 }finally{await close();}
});
