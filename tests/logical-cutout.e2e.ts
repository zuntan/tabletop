import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openTestDesk} from './desk-browser';

test('logical cutout clips all content types, keeps controls/title and supports copy, toggle, save and undo',{timeout:60000},async()=>{
 const {page,call,close,port,errors}=await openTestDesk('logical-cutout');
 try{
  await page.route('**/cutout-fixture',route=>route.fulfill({contentType:'text/html',body:'<html><body style="margin:0;background:linear-gradient(90deg,red 50%,blue 50%);height:100vh"><h1>Web資料</h1></body></html>'}));
  await call('desk_asset_import',{id:'svg',source:{svg:'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="200" height="300" fill="#f44"/><rect x="200" width="200" height="300" fill="#44f"/><text x="30" y="100" font-size="35">ORIGINAL</text></svg>'},x:100,y:100,width:400,height:334});
  await call('desk_execute',{operations:[
   {kind:'add',object:{id:'text',type:'text',x:600,y:100,width:400,height:300,text:'## 原稿の折り返し\n\n型の幅では折り返しません。\n\n**元の文章はそのままです。**',fill:'#fff7ed',fillOpacity:1,stamp:{designId:'done_ja',text:'TEST',angle:-5}}},
   {kind:'add',object:{id:'mermaid',type:'mermaid',x:100,y:500,width:400,height:334,mermaidSource:'flowchart LR\nA[始まり]-->B[次へ]'}},
   {kind:'add',object:{id:'web',type:'web',x:600,y:500,width:400,height:334,url:`http://127.0.0.1:${port}/cutout-fixture`,text:'Web資料'}},
   {kind:'add',object:{id:'m1',type:'ellipse',x:190,y:180,width:220,height:170}},
   {kind:'add',object:{id:'m2',type:'roundedRect',x:660,y:150,width:220,height:170}},
   {kind:'add',object:{id:'m3',type:'diamond',x:190,y:580,width:220,height:170}},
   {kind:'add',object:{id:'m4',type:'ellipse',x:690,y:580,width:220,height:170}}
  ]});
  await page.waitForFunction(()=>document.querySelector('[data-id="mermaid"]')?.getAttribute('data-mermaid-status')==='ready');
  for(const [id,moldId] of [['svg','m1'],['text','m2'],['mermaid','m3'],['web','m4']]){
   await call('desk_select',{ids:[id,moldId]});await page.locator('#cutout-create').click();
   const object=await call('desk_get',{id});assert.equal(object.cutout.enabled,true);assert.equal(object.width,220);
   assert.equal(await page.locator(`[data-id="${id}"] clipPath`).count(),1);
   assert.equal(await page.locator(`[data-id="${id}"] [data-cutout-hit]`).count(),1);
  }
  // Put the molds aside without modifying the already-copied paths.
  await call('desk_execute',{operations:['m1','m2','m3','m4'].map(id=>({kind:'update',id,patch:{x:1300}}))});
  const clipped=await call('desk_get',{id:'svg'});assert.equal(clipped.y,146);assert.equal(clipped.height,204);
  await page.context().grantPermissions(['clipboard-read','clipboard-write']);
  await call('desk_select',{ids:['svg']});await page.locator('#cutout-copy-image').click();
  await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.includes('PNGでコピーしました'));
  const clipboard=await page.evaluate(async()=>{
    const [item]=await navigator.clipboard.read();const blob=await item.getType('image/png');
    const url=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(blob);}),image=new Image();image.src=url;await image.decode();
    const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d')!;ctx.drawImage(image,0,0);
    return {types:[...item.types],width:c.width,height:c.height,cornerAlpha:ctx.getImageData(0,0,1,1).data[3],centerAlpha:ctx.getImageData(c.width/2,c.height/2,1,1).data[3]};
  });
  assert.deepEqual(clipboard.types,['image/png']);assert.equal(clipboard.width,440);assert.equal(clipboard.height,340);assert.equal(clipboard.cornerAlpha,0);assert.equal(clipboard.centerAlpha,255);
  await call('desk_select',{ids:['web']});assert.equal(await page.locator('#cutout-copy-image').isDisabled(),true);

  await call('desk_select',{ids:['svg']});await page.locator('#cutout-toggle').click();let off=await call('desk_get',{id:'svg'});assert.equal(off.cutout.enabled,false);assert.equal(off.x,100);assert.equal(off.width,400);
  await call('desk_execute',{operations:[{kind:'update',id:'svg',patch:{x:200,y:200,width:800,height:634}}]});
  await page.locator('#cutout-toggle').click();const on=await call('desk_get',{id:'svg'});assert.equal(on.width,440);assert.equal(on.x,380);assert.equal(on.y,292);
  await call('desk_select',{ids:['text']});assert.equal(await page.locator('[data-id="text"] > [data-stamp]').count(),0);
  assert.equal(await page.locator('[data-id="text"] [data-cutout-source] [data-stamp]').count(),1);
  await call('desk_point',{ids:['text']});const raster=await call('desk_raster');assert.ok(raster.width<230);
  await page.keyboard.press('Control+c');await page.keyboard.press('Control+v');
  assert.ok((await call('desk_context',{limit:1})).objects.some((o:{id:string;cutout?:unknown;type:string})=>o.id!=='text'&&o.cutout&&o.type==='text'));
  const saved=await call('desk_save',{filename:`cutout-${Date.now()}.tabletop`});
  const before=await call('desk_summary');await call('desk_load',{filename:saved.filename,confirm:true,expectedSessionId:before.sessionId,expectedRevision:before.revision});
  assert.deepEqual((await call('desk_get',{id:'svg'})).cutout,on.cutout);
  const context=await call('desk_context',{limit:1});assert.equal(context.objects.find((o:{id:string})=>o.id==='svg').imageGeometry.status,'clipped');
  await call('desk_camera_move',{center:{x:600,y:470},zoom:.65,durationMs:0});
  await page.screenshot({path:'/tmp/tabletop-logical-cutout.png'});
  assert.deepEqual(errors,[]);
 }finally{await close();}
});
