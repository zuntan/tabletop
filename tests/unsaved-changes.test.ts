import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Desk,dispatch} from '../src/model';

test('unsaved state tracks edits and Undo/Redo but not selection or pointing',()=>{
  const desk=new Desk();assert.equal(desk.hasUnsavedChanges(),false);
  desk.execute({operations:[{kind:'add',object:{id:'a',type:'text',text:'Original'}}]});
  assert.equal(desk.hasUnsavedChanges(),true);assert.equal(desk.markSaved(desk.revision),true);
  desk.select(['a']);desk.point(['a']);desk.pointer={x:10,y:20};assert.equal(desk.hasUnsavedChanges(),false);
  desk.execute({operations:[{kind:'update',id:'a',patch:{text:'Edited'}}]});
  desk.undo();assert.equal(desk.get('a').text,'Original');assert.equal(desk.hasUnsavedChanges(),true);
  desk.markSaved(desk.revision);desk.redo();assert.equal(desk.hasUnsavedChanges(),true);
});

test('only matching successful save/load clears unsaved state, without a document edit',()=>{
  const desk=new Desk();desk.execute({operations:[{kind:'add',object:{id:'a',type:'rect'}}]});
  const savedRevision=desk.revision;
  desk.execute({operations:[{kind:'update',id:'a',patch:{x:100}}]});
  assert.equal(desk.markSaved(savedRevision),false);assert.equal(desk.markSaved(desk.revision+1),false);
  assert.equal(desk.hasUnsavedChanges(),true);
  assert.deepEqual(dispatch(desk,{method:'file_saved',expectedSessionId:crypto.randomUUID(),expectedRevision:desk.revision}),{marked:false});
  const before=desk.summary();
  assert.deepEqual(dispatch(desk,{method:'file_saved',expectedSessionId:desk.sessionId,expectedRevision:desk.revision}),{marked:true});
  assert.deepEqual(desk.summary(),before);assert.equal(desk.hasUnsavedChanges(),false);
  desk.execute({operations:[{kind:'update',id:'a',patch:{x:200}}]});
  assert.throws(()=>desk.replaceDocument({objects:[{id:'bad',type:'image'}],settings:desk.settingsSnapshot()}));
  assert.equal(desk.hasUnsavedChanges(),true);
  desk.replaceDocument({objects:[],settings:desk.settingsSnapshot()});assert.equal(desk.hasUnsavedChanges(),false);
  desk.undo();assert.equal(desk.hasUnsavedChanges(),true);
});
