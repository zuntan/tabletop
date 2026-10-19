import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Desk } from '../src/model';
import { buildJunctionRounding } from '../src/junction-rounding';
function fixture() {
  const desk = new Desk();
  desk.execute({snap:'exact', operations:[
    {kind:'add',object:{id:'a',type:'line',x:0,y:0,x2:100,y2:0,endJunction:'j',junctionRounding:24}},
    {kind:'add',object:{id:'b',type:'line',x:100,y:0,x2:100,y2:100,startJunction:'j'}},
  ]}); return desk;
}
test('rounding trims both shafts, draws once, uses larger request and preserves logical geometry',()=>{
  const d=fixture(), before=d.snapshot(), plan=buildJunctionRounding(before);
  assert.equal(plan.get('a')!.end,24); assert.equal(plan.get('b')!.start,24);
  assert.deepEqual(plan.get('a')!.curves,[{id:'j',from:{x:76,y:0},control:{x:100,y:0},to:{x:100,y:24}}]);
  assert.equal(plan.get('b')!.curves.length,0); assert.deepEqual(d.snapshot(),before);
  d.execute({operations:[{kind:'update',id:'b',patch:{junctionRounding:48}}]});
  assert.equal(buildJunctionRounding(d.snapshot()).get('b')!.curves.length,1);
  assert.equal(buildJunctionRounding(d.snapshot()).get('a')!.end,45);
  d.undo(); assert.deepEqual(buildJunctionRounding(d.snapshot()),plan);
});
test('three-way branches, marked joins and straight joins remain unrounded; detach restores shafts',()=>{
  const d=fixture();
  d.execute({operations:[{kind:'add',object:{id:'c',type:'line',x:100,y:0,x2:150,y2:-100,startJunction:'j'}}]});
  assert.equal(buildJunctionRounding(d.snapshot()).size,0); d.undo();
  d.execute({operations:[{kind:'update',id:'b',patch:{startMarker:'arrow'}}]});
  assert.equal(buildJunctionRounding(d.snapshot()).size,0); d.undo();
  d.execute({operations:[{kind:'update',id:'b',patch:{x2:200,y2:0}}]});
  assert.equal(buildJunctionRounding(d.snapshot()).size,0); d.undo();
  d.execute({operations:[{kind:'update',id:'b',patch:{startJunction:null}}]});
  assert.equal(buildJunctionRounding(d.snapshot()).size,0);
});
test('both ends on a short middle line cannot consume its whole length',()=>{
  const d=fixture();
  d.execute({operations:[{kind:'update',id:'a',patch:{junctionRounding:1000}},
    {kind:'update',id:'b',patch:{endJunction:'k',junctionRounding:1000}},
    {kind:'add',object:{id:'c',type:'line',x:100,y:100,x2:200,y2:100,startJunction:'k'}}]});
  const p=buildJunctionRounding(d.snapshot()).get('b')!;
  assert.equal(p.start+p.end,90); assert.equal(d.get('b').junctionRounding,1000);
});
test('copy keeps numeric requests and creates independent rounded joins',async()=>{
  const {PartClipboard}=await import('../src/part-clipboard');
  const d=fixture(), clipboard=new PartClipboard(), data=new Map<string,string>();
  clipboard.write({setData:(k,v)=>{data.set(k,v);},getData:k=>data.get(k)??''},d.snapshot());
  const copied=clipboard.paste(d);
  assert.equal(d.get(copied[0]).junctionRounding,24);
  assert.notEqual(d.get(copied[0]).endJunction,'j');
  assert.equal([...buildJunctionRounding(d.snapshot()).values()].flatMap(p=>p.curves).length,2);
});
