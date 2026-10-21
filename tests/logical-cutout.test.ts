import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Desk} from '../src/model';
import {sourceRect} from '../src/logical-cutout';

test('cutout copies mold, preserves source, follows move/resize, toggles and overwrites without compounding',()=>{
 const d=new Desk();d.execute({operations:[{kind:'add',object:{id:'a',type:'text',x:100,y:100,width:400,height:300,text:'source'}},{kind:'add',object:{id:'m',type:'ellipse',x:200,y:150,width:150,height:100}}]});
 const apply=()=>d.execute({operations:[{kind:'cutout',id:'a',moldId:'m'}]});apply();let a=d.get('a');assert.equal(a.width,150);assert.equal(a.x,200);assert.deepEqual(sourceRect(a),{x:100,y:100,width:400,height:300});
 const saved=structuredClone(a.cutout);d.execute({operations:[{kind:'update',id:'m',patch:{x:300,width:200}}]});assert.deepEqual(d.get('a').cutout,saved);
 d.execute({operations:[{kind:'update',id:'a',patch:{x:500,y:400,width:300,height:200}}]});a=d.get('a');
 d.execute({operations:[{kind:'update',id:'a',patch:{cutout:{...a.cutout!,enabled:false}}}]});a=d.get('a');assert.equal(a.width,800);assert.equal(a.x,300);assert.equal(a.y,300);
 d.execute({operations:[{kind:'update',id:'a',patch:{cutout:{...a.cutout!,enabled:true}}}]});a=d.get('a');assert.equal(a.x,500);assert.equal(a.width,300);
 d.execute({operations:[{kind:'update',id:'m',patch:{x:400,y:350,width:200,height:200}}]});apply();a=d.get('a');assert.equal(a.width,200);assert.equal(a.cutout!.layout.width,400);assert.equal(sourceRect(a).width,800);
 d.execute({operations:[{kind:'delete',id:'m'}]});assert.ok(d.get('a').cutout);d.undo();assert.equal(d.get('m').type,'ellipse');
});

test('title is outside window; no intersection is atomic, including title-only overlap',()=>{
 const d=new Desk();d.execute({operations:[{kind:'add',object:{id:'a',type:'image',x:100,y:100,width:400,height:334,src:'data:image/png;base64,AA=='}},{kind:'add',object:{id:'m',type:'rect',x:100,y:100,width:100,height:30}}]});
 const revision=d.revision;assert.throws(()=>d.execute({operations:[{kind:'cutout',id:'a',moldId:'m'}]}),/重なって/);assert.equal(d.revision,revision);
 d.execute({operations:[{kind:'update',id:'m',patch:{y:200,height:100}}]});d.execute({operations:[{kind:'cutout',id:'a',moldId:'m'}]});let a=d.get('a');assert.equal(a.y,166);assert.equal(a.height,134);assert.equal(a.cutout!.layout.height,300);
 d.execute({operations:[{kind:'update',id:'a',patch:{cutout:null}}]});a=d.get('a');assert.equal(a.x,100);assert.equal(a.y,100);assert.equal(a.width,400);assert.equal(a.height,334);
});
