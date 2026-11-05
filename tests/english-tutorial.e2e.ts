import test from 'node:test';
import assert from 'node:assert/strict';
import {openTestDesk} from './desk-browser';

test('English tutorial renders, fits its text, follows guide routes and saves intact',{timeout:60000},async()=>{
 const t=await openTestDesk('english-tutorial',undefined,undefined,'en-US');
 try{
  const empty=await t.call('desk_context');
  const loaded=await t.call('desk_load',{path:process.cwd()+'/docs/tabletop/tabletop-guide-en.tabletop',expectedSessionId:empty.sessionId,expectedRevision:empty.revision,confirm:true});
  assert.equal(loaded.count,774);assert.deepEqual(loaded.missingAssets,[]);
  await t.page.waitForFunction(()=>document.querySelectorAll('[data-mermaid-status="ready"]').length===3);
  assert.equal(await t.page.locator('[data-mermaid-status="error"]').count(),0);
  const list=await t.call('desk_list');
  const ids=list.objects.filter((o:any)=>['text','rect','roundedRect'].includes(o.type)).map((o:any)=>o.id);
  for(let i=0;i<ids.length;i+=100){
   const result=await t.call('desk_text_measure',{ids:ids.slice(i,i+100)});
   for(const m of result.measurements){assert.equal(m.status,'measured',m.id);assert.deepEqual(m.overflow,{x:false,y:false},m.id);}
  }
  for(const [id,target] of [['guide-go-start','guide-try-selection-fit'],['guide-go-source-text','tool-detail-text'],['guide-go-detail-text','tool-intro-text']]){
   await t.call('desk_camera_move',{center:{x:0,y:-2000},zoom:.2,durationMs:0});
   const started=await t.call('desk_wayfinder_start',{id});
   assert.equal(started.destinationId,target,JSON.stringify(started));
   await t.page.waitForFunction(()=>document.querySelector('#message')?.textContent?.toLowerCase().includes('arrived'),null,{timeout:12000});
   assert.deepEqual((await t.call('desk_selection')).ids,[target]);
  }
  const saved=await t.call('desk_save',{path:'/tmp/tabletop-english-tutorial-roundtrip.tabletop',overwrite:true});
  const again=await t.call('desk_load',{path:saved.path,expectedSessionId:saved.sessionId,expectedRevision:saved.revision,confirm:true});
  assert.equal(again.count,774);assert.deepEqual(again.missingAssets,[]);
  assert.match((await t.call('desk_get',{id:'text-0cc36b55'})).text,/a tour of the tools/);
  assert.deepEqual(t.errors,[]);
 }finally{await t.close();}
});
