import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Desk} from '../src/model';
import {emptyDoodle,doodleSvg} from '../src/doodle-values';
import {publishObject} from '../src/object-properties';
import {encodeDeskFile,decodeDeskFile} from '../src/desk-file';
test('doodle originals survive resize, copyable publication, save and Undo without scaling points',async()=>{
 const d=new Desk(),doodle=emptyDoodle();doodle.strokes.push({tool:'pen',color:'#ff0000',width:4,points:[{x:12,y:15},{x:300,y:90}]});
 d.execute({operations:[{kind:'add',object:{id:'draw',type:'svg',width:400,height:234,doodle}}]});const before=d.get('draw');
 assert.ok(before.src?.startsWith('data:image/svg+xml;base64,'));assert.deepEqual(publishObject(before).doodle,doodle);
 d.execute({operations:[{kind:'update',id:'draw',patch:{width:100}}]});assert.deepEqual(d.get('draw').doodle,doodle);assert.notEqual(d.get('draw').src,before.src);
 d.undo();assert.equal(d.get('draw').width,400);const restored=await decodeDeskFile(await encodeDeskFile(d));assert.deepEqual(restored.objects[0].doodle,doodle);
 assert.throws(()=>d.execute({operations:[{kind:'add',object:{id:'bad',type:'text',doodle}}]}),/only to SVG/);
});
test('erasers mask preceding ink only; paper is independent and paths preserve raw points',()=>{
 const data=emptyDoodle();data.background='#ffffff';data.strokes=[{tool:'pen',color:'#ff0000',width:8,points:[{x:1,y:1},{x:50,y:50}]},{tool:'eraser',color:'#000000',width:12,points:[{x:25,y:25}]},{tool:'pen',color:'#0000ff',width:2,points:[{x:20,y:20},{x:30,y:30}]}];
 const svg=doodleSvg(data,100,100);assert.ok(svg.includes('mask="url(#erase-1)"'));assert.ok(svg.indexOf('fill="#ffffff"')<svg.indexOf('mask="url(#erase-1)"'));assert.ok(svg.indexOf('stroke="#0000ff"')>svg.indexOf('</g><path'));assert.ok(svg.includes('M1 1 L50 50'));
});
