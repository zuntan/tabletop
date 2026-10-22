import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Desk,type Operation} from '../src/model';
import {fileCreateOperations,fileFor,fileGroup,fileMoveOperations} from '../src/clear-files';
import {bundleOperations} from '../src/clip-bundles';
import {encodeDeskFile,decodeDeskFile} from '../src/desk-file';
import {PartClipboard} from '../src/part-clipboard';
function fixture(){const d=new Desk();d.execute({operations:[
 {kind:'add',object:{id:'a',type:'text',x:103,y:107,width:200,height:100,text:'first'}},
 {kind:'add',object:{id:'outside',type:'rect',x:850,y:100}},
 {kind:'add',object:{id:'b',type:'rect',x:350,y:240,width:100,height:80}},
 {kind:'add',object:{id:'line',type:'line',x:303,y:157,x2:350,y2:280,startBinding:{objectId:'a',anchor:'right'},endBinding:{objectId:'b',anchor:'left'}}},
 ]});return d;}
function file(d:Desk,ids=['a','b','line'],snap=false){const operations=fileCreateOperations(d.snapshot(),ids,snap?d.settingsSnapshot().grid:undefined);d.execute({actor:'human',operations,snap:'exact'});return d.snapshot().find(o=>o.type==='file')!.id;}
function update(d:Desk,id:string,patch:Record<string,unknown>){return d.execute({operations:[{kind:'update',id,patch}]});}
test('file creation keeps relative positions and z-order; grid corrects the whole group once',()=>{
 for(const snap of [false,true]){const d=fixture(),before=d.snapshot(),id=file(d,['a','b','line'],snap),f=d.get(id),dx=d.get('a').x-before[0].x,dy=d.get('a').y-before[0].y;
  assert.deepEqual(f.fileMembers,['a','b','line']);assert.equal(d.get('b').x-before[2].x,dx);assert.equal(d.get('b').y-before[2].y,dy);
  if(snap){assert.equal(f.x%24,0);assert.equal(f.y%24,0);}else{assert.equal(dx,0);assert.equal(dy,0);}
  const ids=d.snapshot().map(o=>o.id);assert.deepEqual(ids.slice(ids.indexOf(id),ids.indexOf(id)+4),[id,'a','b','line']);
  assert.equal(d.get('a').locked,undefined);
 }
});
test('dragging root or any member translates all geometry; resize and internal ordering are rejected atomically',()=>{
 const d=fixture(),id=file(d),a=d.get('a'),b=d.get('b'),line=d.get('line');
 update(d,'a',{x:a.x+48,y:a.y+24});assert.equal(d.get('b').x,b.x+48);assert.equal(d.get('line').x2,line.x2!+48);
 const current=d.snapshot();for(const op of [
  {kind:'update',id:'a',patch:{width:400}}, {kind:'update',id,patch:{height:900}},
  {kind:'update',id:'line',patch:{x:100,y:200}}, {kind:'update',id:'line',patch:{endJunction:'new'}},
  {kind:'reorder',id:'b',index:0},
 ] as Operation[]){assert.throws(()=>d.execute({operations:[op]}));assert.deepEqual(d.snapshot(),current);}
 update(d,'a',{text:'edited',fill:'#ff0000'});assert.equal(d.get('a').text,'edited');
 d.execute({actor:'human',operations:fileMoveOperations(d.snapshot(),['b'],24,48)!});assert.equal(d.get('a').x,a.x+72);assert.equal(d.get('a').y,a.y+72);
});
test('clip groups expand at creation and freeze all structural controls until file release',()=>{
 const d=fixture();d.execute({operations:[{kind:'delete',id:'b'},{kind:'add',object:{id:'b',type:'text',x:350,y:240,width:100,height:80}}]});d.execute({operations:bundleOperations(d.snapshot(),['a','b'])});const clip=d.snapshot().find(o=>o.type==='clip')!.id;
 const id=file(d,['b']);assert.deepEqual(new Set(d.get(id).fileMembers),new Set(['a','b',clip]));
 for(const op of [{kind:'delete',id:'a'},{kind:'delete',id:clip},{kind:'update',id:clip,patch:{clipOffset:300}},{kind:'update',id:clip,patch:{clipStyle:'wire'}},{kind:'update',id:clip,patch:{clipMembers:['a']}}] as Operation[])assert.throws(()=>d.execute({operations:[op]}));
 const cb=new PartClipboard(),data=new Map<string,string>();cb.write({setData:(k,v)=>data.set(k,v),getData:k=>data.get(k)??''},fileGroup(d.snapshot(),id));const copied=cb.paste(d);const copiedClip=d.snapshot().find(o=>o.type==='clip'&&copied.includes(o.id))!;assert.ok(copiedClip.clipMembers?.every(id=>copied.includes(id)));
 const a=d.get('a'),b=d.get('b');d.execute({operations:[{kind:'delete',id}]});assert.equal(d.get('a').x,a.x);assert.equal(d.get('b').y,b.y);assert.deepEqual(d.get(clip).clipMembers,['a','b']);update(d,clip,{clipOffset:300});
});
test('normal member deletion leaves fixed frame; root delete releases; last removal discards empty file; Undo restores',()=>{
 const d=fixture(),id=file(d,['a','b']),f=d.get(id);d.execute({operations:[{kind:'delete',id:'b'}]});assert.equal(d.get(id).width,f.width);assert.deepEqual(d.get(id).fileMembers,['a']);
 d.execute({operations:[{kind:'delete',id:'a'}]});assert.throws(()=>d.get(id));d.undo();assert.ok(d.get(id));
 const a=d.get('a');d.execute({operations:[{kind:'delete',id}]});assert.deepEqual(d.get('a'),a);
});
test('pins, props, nesting, missing/duplicate ownership and empty files reject without changes',()=>{
 const d=fixture(),id=file(d,['a']);
 assert.throws(()=>fileCreateOperations(d.snapshot(),['a','b']));assert.throws(()=>fileCreateOperations(d.snapshot(),[id]));assert.throws(()=>fileCreateOperations(d.snapshot(),[]));
 d.execute({operations:[{kind:'label_add',id:'pin',seriesId:'series-1',x:0,y:0}]});assert.throws(()=>fileCreateOperations(d.snapshot(),['pin','b']));
 for(const members of [[],['a'],[id],['missing'],['b','b'],['pin']])assert.throws(()=>d.execute({operations:[{kind:'add',object:{id:'bad',type:'file',fileMembers:members}}]}));
});
test('outside attachments follow group movement; outside shapes cannot stretch contained lines',()=>{
 const d=fixture();d.execute({operations:[{kind:'add',object:{id:'external',type:'line',x:0,y:0,x2:0,y2:0,endBinding:{objectId:'a',anchor:'left'}}}]});const id=file(d,['a','b','line']);const x=d.get('external').x2!;update(d,id,{x:d.get(id).x+60,y:d.get(id).y});assert.equal(d.get('external').x2,x+60);
 const other=fixture();update(other,'line',{endBinding:{objectId:'outside',anchor:'left'}});file(other,['line']);const frozen=other.get('line');update(other,'outside',{x:900,y:400});assert.equal(other.get('line').x2,frozen.x2);assert.equal(other.get('line').endBinding,null);
});
test('stamp, reactions, archive and whole-file copy preserve membership and remap IDs',async()=>{
 const d=fixture(),id=file(d);update(d,id,{stamp:{designId:'done_ja',text:'ok',angle:-5},reactions:['👍']});
 const bytes=await encodeDeskFile(d),document=await decodeDeskFile(bytes);const restored=new Desk();restored.replaceDocument({objects:document.objects,settings:document.settings});assert.deepEqual(restored.list(),d.list());
 const cb=new PartClipboard(),data=new Map<string,string>();cb.write({setData:(k,v)=>data.set(k,v),getData:k=>data.get(k)??''},fileGroup(d.snapshot(),id));const pasted=cb.paste(d);const copy=d.snapshot().find(o=>o.type==='file'&&o.id!==id)!;
 assert.ok(copy.fileMembers?.every(id=>pasted.includes(id)));assert.deepEqual(copy.stamp,d.get(id).stamp);assert.equal(fileFor(d.snapshot(),copy.fileMembers![0])?.id,copy.id);
});
test('fractional translations retain internal glue and external junctions never pull filed endpoints',()=>{
 const d=fixture();update(d,'a',{x:103.123456789,y:107.23456789});const id=file(d);
 for(let i=0;i<8;i++)update(d,id,{x:d.get(id).x+.123456789,y:d.get(id).y+.23456789});
 assert.equal(d.get('line').startBinding?.objectId,'a');assert.equal(d.get('line').endBinding?.objectId,'b');
 const e=new Desk();e.execute({operations:[
  {kind:'add',object:{id:'inside',type:'line',x:100,y:100,x2:200,y2:200,endJunction:'joint'}},
  {kind:'add',object:{id:'outside',type:'line',x:200,y:200,x2:400,y2:300,startJunction:'joint'}},
 ]});file(e,['inside']);update(e,'outside',{x:250,y:240});assert.equal(e.get('inside').x2,200);assert.equal(e.get('outside').x,200);
});
