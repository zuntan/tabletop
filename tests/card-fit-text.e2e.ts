import test from 'node:test';
import assert from 'node:assert/strict';
import {openTestDesk} from './desk-browser';

test('card fit preserves width and styles, fits Markdown and padding, and rounds height to the snap step',{timeout:45000},async()=>{
 const {page,call,close,errors}=await openTestDesk('card-fit-text',undefined,undefined,'en-US');
 try{
  await call('desk_execute',{operations:[{kind:'grid_update',patch:{enabled:true,interval:96,snapDivisions:4}},{kind:'add',object:{id:'note',type:'text',x:0,y:0,width:300,height:40,text:'# Heading\n\n**Bold** text that wraps across several lines at this width.\n\n- First item\n- Second item',fontSize:24,padding:20,fill:'#fff7ed'}}]});
  await call('desk_select',{ids:['note']});
  const button=page.locator('#card-fit-text');assert.equal(await button.textContent(),'Fit frame to text');
  const measured=(await call('desk_text_measure',{ids:['note']})).measurements[0];
  const original=await call('desk_get',{id:'note'});
  await button.click();
  const fitted=await call('desk_get',{id:'note'});
  assert.equal(fitted.height,Math.ceil(measured.requiredHeight/24)*24);
  assert.deepEqual({...fitted,height:original.height},original);
  assert.deepEqual((await call('desk_text_measure',{ids:['note']})).measurements[0].overflow,{x:false,y:false});
  const revision=(await call('desk_summary')).revision;await button.click();assert.equal((await call('desk_summary')).revision,revision,'already fitted is a no-op');
  await call('desk_undo');assert.equal((await call('desk_get',{id:'note'})).height,40);
  await call('desk_execute',{operations:[{kind:'grid_update',patch:{enabled:false}},{kind:'update',id:'note',patch:{height:1000,text:'Short'}}]});
  const needed=(await call('desk_text_measure',{ids:['note']})).measurements[0].requiredHeight;
  await button.click();assert.equal((await call('desk_get',{id:'note'})).height,needed);
  // Clicking after a property draft must fit the committed new text, not the old card.
  await page.locator('#properties textarea[name="text"]').fill('New text\n\n'+Array(8).fill('Another line').join('\n'));
  await button.click();
  const afterDraft=await call('desk_get',{id:'note'});assert.match(afterDraft.text,/New text/);
  assert.equal(afterDraft.height,(await call('desk_text_measure',{ids:['note']})).measurements[0].requiredHeight);
  assert.deepEqual(errors,[]);
 }finally{await close();}
});

test('card fit is unavailable for non-cards, cutouts and cards inside clear folders',{timeout:30000},async()=>{
 const {page,call,close,errors}=await openTestDesk('card-fit-groups');
 try{
  await call('desk_execute',{operations:[{kind:'add',object:{id:'card',type:'text',x:30,y:70,width:240,height:120,text:'本文'}},{kind:'add',object:{id:'shape',type:'rect',x:20,y:60,width:250,height:140}},{kind:'add',object:{id:'folder',type:'file',x:0,y:0,width:320,height:240,fileMembers:['card','shape'],text:'Folder'}}]});
  await call('desk_select',{ids:['shape']});assert.equal(await page.locator('#card-fit-text').isVisible(),false);
  await call('desk_select',{ids:['card']});assert.equal(await page.locator('#card-fit-text').isDisabled(),true);
  await call('desk_execute',{operations:[{kind:'delete',id:'folder'},{kind:'cutout',id:'card',moldId:'shape'}]});
  assert.equal(await page.locator('#card-fit-text').isDisabled(),true);
  await call('desk_execute',{operations:[{kind:'update',id:'card',patch:{cutout:null}}]});
  assert.equal(await page.locator('#card-fit-text').isEnabled(),true);
  assert.equal(await page.locator('#card-fit-text').textContent(),'枠を文字にあわせる');
  assert.deepEqual(errors,[]);
 }finally{await close();}
});
