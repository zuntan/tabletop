import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Desk,type DeskObject} from '../src/model';
import {anchorPoint} from '../src/geometry';
import {encodeDeskFile,decodeDeskFile} from '../src/desk-file';
import {propertyFieldPatch} from '../src/properties';
function fixture(anchor:NonNullable<DeskObject['clipAnchor']>='top-left',percent=30){
 const d=new Desk();d.execute({operations:[
  ...[{id:'a',width:200,height:100},{id:'b',width:400,height:300},{id:'c',width:100,height:60}].map(o=>({kind:'add' as const,object:{...o,type:'text' as const,x:0,y:0}})),
  {kind:'add',object:{id:'clip',type:'clip',clipMembers:['a','b','c'],clipAnchor:anchor,clipOffset:32,clipOffsetMode:'percent',clipOffsetPercent:percent}},
 ]});return d;
}
test('percentage cascades from each previous paper at all eight anchors',()=>{
 for(const anchor of ['top-left','top','top-right','right','bottom-right','bottom','bottom-left','left'] as const){
  const d=fixture(anchor),a=d.get('a');const origin=anchorPoint(a,anchor);
  const sx=Math.sign(a.x+a.width/2-origin.x),sy=Math.sign(a.y+a.height/2-origin.y);
  const b=anchorPoint(d.get('b'),anchor),c=anchorPoint(d.get('c'),anchor);
  assert.ok(Math.abs(b.x-origin.x-sx*200*.3)<1e-8);assert.ok(Math.abs(b.y-origin.y-sy*100*.3)<1e-8);
  assert.ok(Math.abs(c.x-b.x-sx*400*.3)<1e-8);assert.ok(Math.abs(c.y-b.y-sy*300*.3)<1e-8);
 }
});
test('zero, 100 and over 100 percentages; resizing and switching preserve fixed fallback',()=>{
 const d=fixture('top-left',100);assert.equal(d.get('b').x,200);assert.equal(d.get('b').y,100);
 d.execute({operations:[{kind:'update',id:'b',patch:{width:500}}]});assert.equal(d.get('c').x,700);
 d.execute({operations:[{kind:'update',id:'clip',patch:{clipOffsetPercent:120}}]});assert.equal(d.get('b').x,240);assert.equal(d.get('c').x,840);
 d.execute({operations:[{kind:'update',id:'clip',patch:{clipOffsetPercent:0}}]});assert.equal(d.get('c').x,d.get('a').x);
 d.execute({operations:[{kind:'update',id:'clip',patch:{clipOffsetMode:'fixed'}}]});assert.ok(Math.abs(Math.hypot(d.get('b').x,d.get('b').y)-32)<1e-8);
 d.undo();assert.equal(d.get('clip').clipOffsetMode,'percent');assert.equal(d.get('clip').clipOffsetPercent,0);d.redo();assert.equal(d.get('clip').clipOffsetMode,'fixed');
 assert.deepEqual(propertyFieldPatch('clipOffsetMode','percent',{...d.get('clip'),clipOffsetPercent:undefined}),{clipOffsetMode:'percent',clipOffsetPercent:30});
});
test('percentage fields persist through archive and reject invalid values or non-clip owners',async()=>{
 const d=fixture('left',60),saved=await decodeDeskFile(await encodeDeskFile(d));const restored=new Desk();restored.replaceDocument({objects:saved.objects,settings:saved.settings});assert.deepEqual(restored.list(),d.list());
 const before=d.snapshot();assert.throws(()=>d.execute({operations:[{kind:'update',id:'clip',patch:{clipOffsetPercent:-1}}]}));assert.deepEqual(d.snapshot(),before);
 assert.throws(()=>d.execute({operations:[{kind:'update',id:'a',patch:{clipOffsetMode:'percent'}}]}));
 d.execute({operations:[{kind:'update',id:'clip',patch:{locked:true}}]});assert.throws(()=>d.execute({actor:'human',operations:[{kind:'update',id:'clip',patch:{clipOffsetPercent:90}}]}));
});

test('base short side mode uses a common Euclidean step and follows base size and replacement',async()=>{
 const d=fixture('top-left',60);
 d.execute({operations:[{kind:'update',id:'clip',patch:{clipOffsetMode:'base-short-side'}}]});
 const distance=(id:string)=>{const a=anchorPoint(d.get('a'),'top-left'),p=anchorPoint(d.get(id),'top-left');return Math.hypot(p.x-a.x,p.y-a.y);};
 assert.ok(Math.abs(distance('b')-60)<1e-8);assert.ok(Math.abs(distance('c')-120)<1e-8);
 d.execute({operations:[{kind:'update',id:'b',patch:{width:600,height:600}}]});assert.ok(Math.abs(distance('c')-120)<1e-8);
 d.execute({operations:[{kind:'update',id:'a',patch:{height:150}}]});assert.ok(Math.abs(distance('b')-90)<1e-8);
 const file=await decodeDeskFile(await encodeDeskFile(d));const restored=new Desk();restored.replaceDocument({objects:file.objects,settings:file.settings});assert.deepEqual(restored.list(),d.list());
 d.execute({operations:[{kind:'update',id:'clip',patch:{clipMembers:['b','c']}}]});const a=anchorPoint(d.get('b'),'top-left'),c=anchorPoint(d.get('c'),'top-left');assert.ok(Math.abs(Math.hypot(c.x-a.x,c.y-a.y)-360)<1e-8);
 assert.deepEqual(propertyFieldPatch('clipOffsetMode','base-short-side',{...d.get('clip'),clipOffsetMode:'fixed',clipOffsetPercent:undefined}),{clipOffsetMode:'base-short-side',clipOffsetPercent:30});
});
