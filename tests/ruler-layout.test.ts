import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Desk} from '../src/model';
import {rulerCreateOperations,rulerMoveOperations,rulerGroup} from '../src/ruler-layout';
import {fileCreateOperations} from '../src/clear-files';
import {encodeDeskFile,decodeDeskFile} from '../src/desk-file';
import {publishObject} from '../src/object-properties';
import {PartClipboard,partClipboardType} from '../src/part-clipboard';

function fixture(mode:'free'|'gap'|'center'='gap'){
 const d=new Desk();d.execute({operations:[
  {kind:'add',object:{id:'a',type:'text',x:0,y:20,width:100,height:100,text:'a'}},
  {kind:'add',object:{id:'b',type:'rect',x:0,y:150,width:200,height:200,text:'b'}},
  {kind:'add',object:{id:'c',type:'text',x:0,y:360,width:150,height:50,text:'c'}},
  {kind:'add',object:{id:'left',type:'text',x:-80,y:50,width:80,height:60}},
  {kind:'add',object:{id:'r',type:'ruler',x:0,y:0,width:36,height:500,rulerThickness:36,rulerMode:mode,rulerMembers:[{id:'a',side:'after'},{id:'b',side:'after'},{id:'c',side:'after'},{id:'left',side:'before'}]}}
 ]});return d;
}
test('ruler gap layout includes final size, two independent sides and contiguous member layers',()=>{
 const d=fixture();assert.equal(d.get('a').y,0);assert.equal(d.get('b').y,175);assert.equal(d.get('c').y,450);
 assert.equal(d.get('left').y,0);assert.equal(d.get('left').x,-80);assert.equal(d.get('b').x,36);
 assert.deepEqual(d.snapshot().map(o=>o.id),['a','b','c','left','r']);
 d.execute({operations:[{kind:'reorder',id:'b',index:0}]});assert.equal(d.snapshot().at(-1)!.id,'r');
});
test('center layout differs from equal gaps and length resize recomputes',()=>{
 const d=fixture('center');assert.equal(d.get('a').y,0);assert.equal(d.get('b').y,162.5);assert.equal(d.get('c').y,450);
 d.execute({operations:[{kind:'update',id:'r',patch:{height:700}}]});assert.equal(d.get('c').y,650);
});
test('minimum geometry and four world unit center step prevent reversed order, independent of zoom',()=>{
 const d=fixture('center');d.execute({operations:[{kind:'update',id:'r',patch:{height:2,width:1}}]});assert.equal(d.get('r').height,120);assert.equal(d.get('r').width,36);
 const centers=['a','b','c'].map(id=>{const o=d.get(id);return o.y+o.height/2;});assert.ok(centers[1]-centers[0]>=4);assert.ok(centers[2]-centers[1]>=4);
 const gap=fixture();gap.execute({operations:[{kind:'update',id:'r',patch:{height:120}}]});const cc=['a','b','c'].map(id=>{const o=gap.get(id);return o.y+o.height/2;});assert.ok(cc[1]-cc[0]>=4&&cc[2]-cc[1]>=4);
});
test('free axis movement, material changes and rotation preserve offsets; ruler translates all members',()=>{
 const d=fixture('free');assert.equal(d.get('a').y,20);
 d.execute({operations:[{kind:'update',id:'a',patch:{x:999,y:80}}]});assert.equal(d.get('a').x,36);assert.equal(d.get('a').y,80);
 d.execute({operations:[{kind:'update',id:'r',patch:{x:100,y:200,rulerMaterial:'steel'}}]});assert.equal(d.get('a').x,136);assert.equal(d.get('a').y,280);
 d.execute({operations:[{kind:'update',id:'r',patch:{width:600,height:36}}]});assert.equal(d.get('r').rulerAxis,'horizontal');assert.equal(d.get('a').x,180);assert.equal(d.get('a').y,236);assert.equal(d.get('left').y,140);
 d.execute({operations:[{kind:'update',id:'r',patch:{width:200,height:200}}]});assert.equal(d.get('r').rulerAxis,'horizontal');
});
test('Alt peels one card with shared Undo, automatic drag reorders only its side',()=>{
 const d=fixture();const before=d.snapshot();const ops=rulerMoveOperations(d.snapshot(),['b'],500,50,true,{x:0,y:0},1)!;
 d.execute({actor:'human',operations:ops});assert.equal(d.get('r').rulerMembers?.some(m=>m.id==='b'),false);assert.equal(d.get('b').x,536);d.undo();assert.deepEqual(d.snapshot(),before);
 d.execute({operations:rulerMoveOperations(d.snapshot(),['c'],0,-600,false,{x:0,y:0},1)!});assert.deepEqual(d.get('r').rulerMembers?.map(m=>m.id),['c','a','b','left']);assert.equal(d.get('c').y,0);assert.equal(d.get('left').y,0);
});
test('drop attaches cards, move ruler and delete releases in place; deleted member dissolves ruler like clip',()=>{
 const d=fixture('free');d.execute({operations:[{kind:'add',object:{id:'new',type:'ellipse',x:800,y:80,width:80,height:50}}]});
 d.execute({operations:rulerMoveOperations(d.snapshot(),['new'],-800,0,false,{x:36,y:80},1)!});assert.equal(d.get('new').x,36);assert.equal(d.get('r').rulerMembers!.at(-1)!.id,'new');
 const before=d.get('a');d.execute({operations:[{kind:'delete',id:'r'}]});assert.deepEqual(d.get('a'),before);d.undo();d.execute({operations:[{kind:'delete',id:'new'}]});assert.throws(()=>d.get('r'));assert.ok(d.get('a'));
});
test('locks propagate across entire ruler and ownership conflicts fail atomically',()=>{
 const d=fixture();d.execute({operations:[{kind:'update',id:'a',patch:{locked:true}}]});assert.ok(rulerGroup(d.snapshot(),'a').every(o=>o.locked));
 assert.throws(()=>d.execute({actor:'human',operations:[{kind:'delete',id:'b'}]}));
 d.execute({operations:[{kind:'update',id:'r',patch:{locked:false}}]});
 const before=d.snapshot();assert.throws(()=>d.execute({operations:[{kind:'add',object:{id:'clip',type:'clip',clipMembers:['a']}}]}));assert.deepEqual(d.snapshot(),before);
 assert.throws(()=>d.execute({operations:[{kind:'add',object:{id:'r2',type:'ruler',rulerMembers:[{id:'a',side:'before'}]}}]}));
});
test('file contains whole ruler bundle and freezes membership, deletion, resize and internal layout',()=>{
 const d=fixture();d.execute({operations:fileCreateOperations(d.snapshot(),['a'])});const f=d.snapshot().find(o=>o.type==='file')!;assert.equal(f.fileMembers!.length,5);
 const before=d.snapshot();for(const op of [{kind:'delete',id:'r'},{kind:'delete',id:'a'},{kind:'update',id:'r',patch:{height:800}},{kind:'update',id:'r',patch:{rulerMode:'free'}}] as const)assert.throws(()=>d.execute({operations:[op]}));assert.deepEqual(d.snapshot(),before);
 const old=d.get('a');d.execute({operations:[{kind:'update',id:f.id,patch:{x:f.x+60,y:f.y+40}}]});assert.equal(d.get('a').x,old.x+60);assert.equal(d.get('a').y,old.y+40);
 d.execute({operations:[{kind:'delete',id:f.id}]});d.execute({operations:[{kind:'update',id:'r',patch:{height:700}}]});assert.equal(d.get('c').y,d.get('r').y+650);
});
test('ruler save/load and copy remap ownership, no shared references',async()=>{
 const d=fixture();const archive=await decodeDeskFile(await encodeDeskFile(d));const restored=new Desk();restored.replaceDocument({objects:archive.objects,settings:archive.settings});assert.deepEqual(restored.snapshot().map(publishObject),d.snapshot().map(publishObject));
 const data=new Map<string,string>(),clip=new PartClipboard();clip.write({setData:(k,v)=>data.set(k,v),getData:k=>data.get(k)??''},rulerGroup(d.snapshot(),'r'));
 assert.ok(data.get(partClipboardType));const ids=clip.paste(d);const ruler=ids.map(id=>d.get(id)).find(o=>o.type==='ruler')!;assert.ok(ruler.rulerMembers?.every(m=>ids.includes(m.id)));assert.equal(ruler.rulerMembers!.length,4);
});
test('zero and one member rulers are valid; invalid target types and off-type fields reject',()=>{
 const d=new Desk();d.execute({operations:rulerCreateOperations([],[],{x:0,y:0})});assert.equal(d.snapshot()[0].rulerMembers!.length,0);
 assert.throws(()=>d.execute({operations:[{kind:'add',object:{id:'bad',type:'line',rulerMembers:[]}}]}));
 d.execute({operations:[{kind:'add',object:{id:'line',type:'line'}}]});assert.throws(()=>d.execute({operations:[{kind:'add',object:{id:'bad',type:'ruler',rulerMembers:[{id:'line',side:'after'}]}}]}));
});

test('mixed ruler and line movement translates both line endpoints; member resizing reflows and connectors follow',()=>{
 const d=fixture();d.execute({operations:[{kind:'add',object:{id:'connector',type:'line',x:100,y:100,x2:500,y2:300}}]});
 d.execute({operations:rulerMoveOperations(d.snapshot(),['r','connector'],30,50,false,{x:0,y:0},1)!});const line=d.get('connector');assert.equal(line.x,130);assert.equal(line.x2,530);assert.equal(line.y,150);assert.equal(line.y2,350);
 d.execute({operations:[{kind:'update',id:'a',patch:{height:200}},{kind:'add',object:{id:'bound',type:'line',startBinding:{objectId:'a',anchor:'top'}}}]});assert.equal(d.get('c').y,d.get('r').y+450);assert.equal(d.get('bound').y,d.get('a').y);
 assert.throws(()=>d.execute({operations:[{kind:'add',object:{id:'partial-file',type:'file',fileMembers:['r','a']}}]}));
});
