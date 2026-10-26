import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Desk} from '../src/model';
import {snapLinePoint,simplifyStroke,continuousLineOperations} from '../src/continuous-lines';
import {buildJunctionRounding} from '../src/junction-rounding';
import {encodeDeskFile,decodeDeskFile} from '../src/desk-file';
const grid={enabled:true,interval:24,origin:{x:0,y:0}};
test('click vertices become ordinary joined lines, one-step append and Undo retain existing endpoints',()=>{
 const d=new Desk();const points=[{x:0,y:0},{x:150,y:0},{x:150,y:150}];const first=continuousLineOperations([],points,{}, {point:points[0]},{point:points[2]});d.execute({operations:first.operations});assert.equal(d.get(first.ids[0]).endJunction,d.get(first.ids[1]).startJunction);assert.equal(buildJunctionRounding(d.snapshot()).size,2);
 const source=d.get(first.ids[1]);const next=continuousLineOperations(d.snapshot(),[points[2],{x:300,y:150}],{}, {point:points[2],endpoint:{id:source.id,side:'end'}},{point:{x:300,y:150}});d.execute({operations:next.operations});assert.equal(d.get(source.id).endJunction,d.get(next.ids[0]).startJunction);d.undo();assert.deepEqual(d.get(source.id),source);
});
test('snap prioritizes nearest anchors and line endpoints, shares existing junctions, Alt bypasses grid',()=>{
 const d=new Desk();d.execute({operations:[{kind:'add',object:{id:'rect',type:'rect',x:300,y:0,width:100,height:100}},{kind:'add',object:{id:'line',type:'line',x:0,y:0,x2:100,y2:0}}]});
 const a=snapLinePoint({x:99,y:2},d.snapshot(),1,grid);assert.deepEqual(a.endpoint,{id:'line',side:'end'});
 const b=snapLinePoint({x:300,y:49},d.snapshot(),1,grid);assert.equal(b.binding?.objectId,'rect');assert.equal(b.binding?.anchor,'left');
 const result=continuousLineOperations(d.snapshot(),[a.point,b.point],{},a,b);d.execute({operations:result.operations});assert.equal(d.get('line').endJunction,d.get(result.ids[0]).startJunction);assert.deepEqual(d.get(result.ids[0]).endBinding,b.binding);
 assert.deepEqual(snapLinePoint({x:13,y:14},[],1,grid).point,{x:24,y:24});assert.deepEqual(snapLinePoint({x:13,y:14},[],1,grid,true).point,{x:13,y:14});
});
test('closed strokes connect ends, preserve vertices and serialize without a new object type',async()=>{
 const d=new Desk();const p=[{x:0,y:0},{x:200,y:0},{x:150,y:180},{x:0,y:0}];const result=continuousLineOperations([],p,{}, {point:p[0]},{point:p[0]});d.execute({operations:result.operations});assert.equal(d.get(result.ids[0]).startJunction,d.get(result.ids[2]).endJunction);assert.ok(d.snapshot().every(o=>o.type==='line'));
 const archive=await decodeDeskFile(await encodeDeskFile(d));assert.equal(archive.objects.length,3);assert.equal(archive.objects[0].startJunction,archive.objects[2].endJunction);
});
test('rough cleanup removes jitter, preserves strong turns, caps complexity and rejects taps',()=>{
 const line=Array.from({length:300},(_,i)=>({x:i,y:Math.sin(i)*1.5}));assert.equal(simplifyStroke(line,1).length,2);
 const corner=[...Array.from({length:101},(_,i)=>({x:i*2,y:Math.sin(i)})),...Array.from({length:100},(_,i)=>({x:200+Math.sin(i),y:i*2}))];assert.equal(simplifyStroke(corner,1).length,3);
 const noisy=Array.from({length:4096},(_,i)=>({x:i,y:100*Math.sin(i*.1)}));assert.ok(simplifyStroke(noisy,1).length<=25);
 assert.deepEqual(simplifyStroke([{x:0,y:0},{x:2,y:2}],1),[]);
 assert.equal(continuousLineOperations([],[{x:1,y:1},{x:1,y:1}],{}, {point:{x:1,y:1}},{point:{x:1,y:1}}).operations.length,0);
 assert.deepEqual(simplifyStroke(line.map(p=>({x:p.x/2,y:p.y/2})),2),simplifyStroke(line,1).map(p=>({x:p.x/2,y:p.y/2})));
});
test('free stroke is one atomic Undo, keeps line appearance and forces internal arrowheads off',()=>{
 const d=new Desk();const p=[{x:0,y:0},{x:100,y:0},{x:100,y:200}];const r=continuousLineOperations([],p,{stroke:'#ff0000',strokeWidth:8,endMarker:'arrow'}, {point:p[0]},{point:p[2]});d.execute({operations:r.operations});assert.equal(d.snapshot().length,2);assert.ok(d.snapshot().every(o=>o.strokeWidth===8&&o.endMarker==='none'));d.undo();assert.equal(d.snapshot().length,0);d.redo();assert.equal(d.snapshot().length,2);
});
