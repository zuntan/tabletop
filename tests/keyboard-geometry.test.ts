import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Desk} from '../src/model';
import {keyboardGeometry,KeyboardGeometryEdit} from '../src/keyboard-geometry';
function setup(type='rect') {const d=new Desk();d.execute({snap:'exact',operations:[{kind:'add',object:{id:'a',type,...(type==='prop'?{src:'data:image/svg+xml;base64,PHN2Zy8+'}:{}),x:0,y:0,width:48,height:48}}] as any});return d;}
function press(d:Desk,key:string,resize=false,alt=false){const operations=keyboardGeometry(d.snapshot(),['a'],key,resize,alt,d.settingsSnapshot().grid,1);if(operations.length)d.execute({actor:'human',snap:'exact',operations});}
test('arrows use effective snap size; Alt bypasses; Shift resizes with a minimum of one snap step',()=>{
 const d=setup();press(d,'ArrowRight');assert.equal(d.get('a').x,24);
 press(d,'ArrowDown',false,true);assert.equal(d.get('a').y,1);
 press(d,'ArrowLeft',true);press(d,'ArrowLeft',true);assert.equal(d.get('a').width,24);
 press(d,'ArrowLeft',true,true);assert.equal(d.get('a').width,23);
 press(d,'ArrowRight',true);assert.equal(d.get('a').width,24);
 assert.equal(d.get('a').height,48);assert.equal(d.get('a').x,24);
});
test('ordinary props and wayfinders resize, special container and head prop sizes remain unchanged',()=>{
 for(const type of ['prop','wayfinder','clip','ruler']){
  // Use the schema defaults/preset-independent empty containers.
  const d=setup(type);const before=d.get('a');press(d,'ArrowRight',true);
  assert.equal(d.get('a').width,['prop','wayfinder'].includes(type)?before.width+24:before.width);
 }
 const d=setup('prop');d.execute({operations:[{kind:'update',id:'a',patch:{propSelection:'head'}}]});press(d,'ArrowRight',true);assert.equal(d.get('a').width,48);
});
test('preview repeats do not commit history; release commits once and intervening changes reject',()=>{
 const d=setup(),edit=new KeyboardGeometryEdit(d.snapshot(),['a'],d.settingsSnapshot().grid),revision=d.revision;
 edit.step('ArrowRight',false,false,1);edit.step('ArrowRight',false,false,1);
 assert.equal(d.revision,revision);assert.equal(d.get('a').x,0);assert.equal(edit.scene[0].x,48);
 d.execute({actor:'human',snap:'exact',expectedRevision:revision,operations:edit.operations()});
 d.undo();assert.equal(d.get('a').x,0);d.redo();assert.equal(d.get('a').x,48);
 assert.throws(()=>d.execute({actor:'human',expectedRevision:revision,operations:edit.operations()}),/Revision conflict/);
 d.execute({operations:[{kind:'update',id:'a',patch:{locked:true}}]});press(d,'ArrowRight');assert.equal(d.get('a').x,48);
});
test('file members move with their file, and cannot be keyboard resized independently',()=>{
 const d=setup();d.execute({snap:'exact',operations:[{kind:'add',object:{id:'f',type:'file',x:0,y:0,fileMembers:['a']}}]});
 const before=d.snapshot(),ops=keyboardGeometry(before,['f'],'ArrowRight',false,false,d.settingsSnapshot().grid,1);
 d.execute({snap:'exact',actor:'human',operations:ops});assert.notEqual(d.get('a').x,before.find(o=>o.id==='a')!.x);
 assert.deepEqual(keyboardGeometry(d.snapshot(),['a'],'ArrowRight',true,false,d.settingsSnapshot().grid,1),[]);
 assert.deepEqual(keyboardGeometry(d.snapshot(),['f'],'ArrowRight',true,false,d.settingsSnapshot().grid,1),[]);
});
test('multiple selected cards preserve relative positions; resizing requires exactly one card',()=>{
 const d=setup();d.execute({snap:'exact',operations:[{kind:'add',object:{id:'b',type:'rect',x:37,y:65}}]});
 const ids=['a','b'];d.execute({snap:'exact',actor:'human',operations:keyboardGeometry(d.snapshot(),ids,'ArrowRight',false,false,d.settingsSnapshot().grid,1)});
 assert.equal(d.get('b').x-d.get('a').x,37);assert.equal(d.get('b').y-d.get('a').y,65);
 assert.deepEqual(keyboardGeometry(d.snapshot(),ids,'ArrowRight',true,false,d.settingsSnapshot().grid,1),[]);
});
test('geometry commit keeps history immutable, isolates inputs/reads and rejects non-geometry edits',()=>{
 const d=setup();const revision=d.revision;const ops=keyboardGeometry(d.snapshot(),['a'],'ArrowRight',false,false,d.settingsSnapshot().grid,1);
 d.commitGeometry({actor:'human',snap:'exact',operations:ops});assert.equal(d.get('a').x,24);
 if(ops[0].kind==='update')ops[0].patch.x=999;
 const snapshot=d.snapshot();snapshot[0].x=888;assert.equal(d.get('a').x,24);
 d.commitGeometry({actor:'human',snap:'exact',operations:[{kind:'update',id:'a',patch:{x:48}}]});
 d.undo();assert.equal(d.get('a').x,24);d.undo();assert.equal(d.get('a').x,0);d.redo();assert.equal(d.get('a').x,24);
 const current=d.revision;
 assert.throws(()=>d.commitGeometry({operations:[{kind:'update',id:'a',patch:{text:'not geometry'}}]}),/Geometry updates only/);
 assert.throws(()=>d.commitGeometry({operations:[{kind:'update',id:'a',patch:{x:50}},{kind:'update',id:'missing',patch:{x:5}}]}));
 assert.equal(d.revision,current);assert.equal(d.get('a').x,24);assert.ok(current>revision);
 d.execute({operations:[{kind:'update',id:'a',patch:{text:'later edit'}}]});d.undo();assert.equal(d.get('a').x,24);assert.equal(d.get('a').text,'');
});
