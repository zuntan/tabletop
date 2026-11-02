import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Desk} from '../src/model';
import {initialFocusTarget} from '../src/initial-focus';
import {encodeDeskFile,decodeDeskFile} from '../src/desk-file';
test('URL focus, saved focus, PDF priority and legacy absence',()=>{
 const pick=(query:string,saved?:string|null)=>initialFocusTarget(new URLSearchParams(query),saved);
 assert.equal(pick(''),null);assert.equal(pick('','saved'),'saved');
 assert.equal(pick('focus=url','saved'),'url');assert.equal(pick('focus=','saved'),'saved');
 assert.equal(pick('focus=missing','saved'),'missing');
 assert.equal(pick('pdf=1&focus=url','saved'),null);assert.equal(pick('pdf=0','saved'),null);assert.equal(pick('pdf=&focus=url','saved'),'url');
});
test('initial view is persisted with Undo without moving objects or human selection',async()=>{
 const d=new Desk();assert.equal(d.settingsSnapshot().initialFocusId,undefined);
 d.execute({operations:[{kind:'add',object:{id:'start',type:'text'}}]});d.select(['start']);const before=d.snapshot();
 d.execute({operations:[{kind:'initial_view_update',targetId:'start'}]});assert.equal(d.settingsSnapshot().initialFocusId,'start');assert.deepEqual(d.snapshot(),before);assert.deepEqual(d.selected(),['start']);
 const decoded=await decodeDeskFile(await encodeDeskFile(d));assert.equal(decoded.settings.initialFocusId,'start');
 d.undo();assert.equal(d.settingsSnapshot().initialFocusId,undefined);d.redo();assert.equal(d.settingsSnapshot().initialFocusId,'start');
 d.execute({operations:[{kind:'initial_view_update',targetId:null}]});assert.equal(d.settingsSnapshot().initialFocusId,null);d.undo();assert.equal(d.settingsSnapshot().initialFocusId,'start');
 assert.throws(()=>d.execute({operations:[{kind:'initial_view_update',targetId:''}]}));
});
