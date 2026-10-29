import test from 'node:test';
import assert from 'node:assert/strict';
import {Desk,dispatch,requestSchema} from '../src/model';
import {pinFitOperations} from '../src/pin-fit';
import {captureBounds} from '../src/desk-capture';

test('pin fitting includes next number, validates every series before atomic edit and preserves attachment tip',()=>{
 const d=new Desk();d.execute({operations:[{kind:'series_update',id:'series-1',patch:{fontSize:12,width:90,height:100}},{kind:'series_add',series:{id:'empty',name:'Empty',fontSize:18}},...Array.from({length:9},(_,i)=>({kind:'label_add' as const,id:`p${i}`,seriesId:'series-1',x:i*100,y:100}))]});
 d.execute({snap:'exact',operations:[{kind:'add',object:{id:'card',type:'rect',x:100,y:100,width:200,height:100}},{kind:'update',id:'p0',patch:{attachment:{objectId:'card',anchor:'top'}}}]});
 const before=d.get('p0'),revision=d.revision;
 const ops=pinFitOperations(d,['series-1','empty','series-1'],(t,size)=>t.length*size);
 assert.equal(ops.length,2);assert.deepEqual(ops[0],{kind:'series_update',id:'series-1',patch:{width:36,height:48}});
 assert.throws(()=>pinFitOperations(d,['series-1','missing']),/Unknown/);assert.equal(d.revision,revision);
 d.execute({operations:ops});const after=d.get('p0');assert.equal(after.x+after.width/2,before.x+before.width/2);assert.equal(after.y+after.height,before.y+before.height);
 d.undo();assert.equal(d.get('p0').width,90);
});

test('region raster requires an explicit rectangle or IDs, respects negative line bounds and revision',()=>{
 const d=new Desk();d.execute({operations:[{kind:'add',object:{id:'a',type:'line',x:100,y:50,x2:-50,y2:-100}},{kind:'add',object:{id:'b',type:'rect',x:200,y:100,width:80,height:60}}]});
 assert.deepEqual(captureBounds(d,{ids:['a','b'],scale:1}),{x:-50,y:-100,width:330,height:260});
 assert.throws(()=>captureBounds(d,{scale:1}),/exactly one/);
 assert.throws(()=>captureBounds(d,{ids:['a'],bounds:{x:0,y:0,width:1,height:1},scale:1}),/exactly one/);
 assert.throws(()=>captureBounds(d,{ids:['a'],scale:1,expectedRevision:0}),/Revision/);
 assert.throws(()=>requestSchema.parse({method:'raster',bounds:{x:0,y:0,width:0,height:10}}));
 let legacy=0,region=0;
 dispatch(d,{method:'raster'},undefined,undefined,undefined,undefined,()=>{legacy++;return Promise.resolve({});},undefined,{capture:()=>{region++;return Promise.resolve({});}});
 dispatch(d,{method:'raster',ids:['a']},undefined,undefined,undefined,undefined,()=>{legacy++;return Promise.resolve({});},undefined,{capture:()=>{region++;return Promise.resolve({});}});
 assert.equal(legacy,1);assert.equal(region,1);
});
