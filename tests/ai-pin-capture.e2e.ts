import test from 'node:test';
import assert from 'node:assert/strict';
import {openTestDesk} from './desk-browser';
import {callTestTool} from './mcp-call';

test('AI pin fitting uses the human fit operation and groups multiple series in one Undo',{timeout:45000},async()=>{
 const {page,call,client,close,errors}=await openTestDesk('ai-pin-fit');
 try{
  await call('desk_execute',{operations:[{kind:'series_update',id:'series-1',patch:{fontSize:12,width:100,height:120}},{kind:'series_add',series:{id:'second',name:'Second',fontSize:18,width:120,height:120}},...Array.from({length:9},(_,i)=>({kind:'label_add',id:`p${i}`,seriesId:'series-1',x:100+i*35,y:100}))]});
  await call('desk_select',{ids:['p0']});await call('desk_point',{ids:['p1']});
  const before=await call('desk_context');const fitted=await call('desk_pin_fit',{seriesIds:['series-1','second'],expectedRevision:before.revision});
  assert.equal(fitted.revision,before.revision+1);assert.equal(fitted.frames.length,2);
  const after=(await call('desk_settings')).series.find((s:any)=>s.id==='series-1');assert.ok(after.width<100);
  assert.deepEqual((await call('desk_selection')).ids,['p0']);
  await call('desk_undo');const undone=(await call('desk_settings')).series;assert.equal(undone[0].width,100);assert.equal(undone[1].width,120);
  if(!await page.locator('#series-panel').isVisible())await page.locator('#numbering-settings').click();await page.locator('#series-choice').selectOption('series-1');await page.locator('#series-fit').click();
  const human=(await call('desk_settings')).series.find((s:any)=>s.id==='series-1');assert.equal(human.width,after.width);assert.equal(human.height,after.height);
  const revision=(await call('desk_summary')).revision;
  const bad=await callTestTool(client,{name:'desk_pin_fit',arguments:{seriesIds:['series-1','no-such-series']}});assert.equal(bad.isError,true);assert.equal((await call('desk_summary')).revision,revision);
  const stale=await callTestTool(client,{name:'desk_pin_fit',arguments:{seriesIds:['series-1'],expectedRevision:before.revision}});assert.equal(stale.isError,true);
  assert.deepEqual(errors,[]);
 }finally{await close();}
});

test('unified raster returns a clean region PNG without moving camera, selection or clipboard',{timeout:45000},async()=>{
 const {page,call,client,close,errors}=await openTestDesk('ai-region-raster',`Object.defineProperty(navigator,'clipboard',{value:{write:()=>{throw Error('AI must not access clipboard')}}});`);
 try{
  const tools=await client.listTools();assert.equal(tools.tools.some(t=>t.name==='desk_capture'),false);
  await call('desk_execute',{operations:[{kind:'add',object:{id:'red',type:'rect',x:0,y:0,width:400,height:300,fill:'#ff0000',fillOpacity:1,stroke:'transparent'}},{kind:'add',object:{id:'blue',type:'rect',x:100,y:100,width:100,height:100,fill:'#0000ff',fillOpacity:1,stroke:'transparent'}}]});
  await call('desk_select',{ids:['red']});await call('desk_point',{ids:['blue']});
  const before=await call('desk_state'),camera=await call('desk_camera_get');
  const result=await callTestTool(client,{name:'desk_raster',arguments:{ids:['red'],expectedRevision:before.revision}});assert.notEqual(result.isError,true,JSON.stringify(result));
  const content=result.content as any[],meta=JSON.parse(content[0].text);assert.equal(meta.width,400);assert.equal(meta.height,300);assert.ok(meta.path.endsWith('.png'));
  const png=content.find(c=>c.type==='image');
  const pixels=await page.evaluate(async src=>{const image=new Image();image.src=src;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);return [Array.from(ctx.getImageData(1,1,1,1).data),Array.from(ctx.getImageData(150,150,1,1).data)];},`data:image/png;base64,${png.data}`);
  assert.deepEqual(pixels,[[255,0,0,255],[0,0,255,255]]);
  const scaled=await callTestTool(client,{name:'desk_raster',arguments:{bounds:{x:0,y:0,width:400,height:300},scale:.5}});assert.notEqual(scaled.isError,true);assert.equal(JSON.parse((scaled.content as any)[0].text).width,200);
  assert.deepEqual((await call('desk_state')).objects,before.objects);assert.equal((await call('desk_summary')).revision,before.revision);assert.deepEqual(await call('desk_camera_get'),camera);assert.deepEqual((await call('desk_selection')).ids,['red']);
  const bad=await callTestTool(client,{name:'desk_raster',arguments:{ids:['red'],bounds:{x:0,y:0,width:10,height:10}}});assert.equal(bad.isError,true);
  assert.deepEqual(errors,[]);
 }finally{await close();}
});
