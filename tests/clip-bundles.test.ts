import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Desk, dispatch } from '../src/model';
import { bundleOperations,clipFor,clipFollower,clipMoveOperations,unbundleOperations,clipGroup } from '../src/clip-bundles';
import { anchorPoint,snap } from '../src/geometry';
import { gestureOperations,gesturePreview,type Gesture } from '../src/diagram-gestures';
import { encodeDeskFile,decodeDeskFile } from '../src/desk-file';
import { PartClipboard } from '../src/part-clipboard';
function fixture() {
 const d=new Desk();d.execute({operations:[
  ...['a','b','c'].map((id,i)=>({kind:'add' as const,object:{id,type:'text' as const,x:100+i*350,y:100,width:200-i*20,height:120,text:id}})),
  {kind:'add',object:{id:'outside',type:'rect',x:900,y:500}},
  {kind:'label_add',id:'pin',seriesId:'series-1',x:0,y:0},
  {kind:'update',id:'pin',patch:{attachment:{objectId:'b',anchor:'top'}}},
  {kind:'add',object:{id:'line',type:'line',x:0,y:0,x2:0,y2:0,endBinding:{objectId:'b',anchor:'left'}}},
  {kind:'add',object:{id:'comment',type:'text',x:900,y:300,callout:{x:0,y:0,binding:{objectId:'b',anchor:'right'}}}},
 ]});return d;
}
function bundle(d:Desk,ids=['a','b','c']) {const ops=bundleOperations(d.snapshot(),ids);d.execute({operations:ops});return clipFor(d.snapshot(),ids[0])!.id;}
function drag(d:Desk,id:string,dx:number,dy:number,detach=false) {
 const scene=d.snapshot();const g:Gesture={mode:'move',start:{x:0,y:0},screen:{x:0,y:0},originals:[d.get(id)],scene,preview:scene,revision:d.revision,camera:{x:0,y:0},additive:[],anchorId:id,detach};
 const preview=gesturePreview(g,{x:dx,y:dy},1);d.execute({operations:gestureOperations(g,{x:dx,y:dy},1),snap:'exact'});assert.deepEqual(d.snapshot(),preview);
}
test('ordered cards cascade at their matching anchors; followers disconnect once, zero and huge offsets validate atomically',()=>{
 const d=fixture(),pin=d.get('pin'),line=d.get('line'),clip=bundle(d);
 const a=d.get('a'),b=d.get('b'),c=d.get('c');assert.ok(Math.abs(Math.hypot(b.x-a.x,b.y-a.y)-32)<1e-8);assert.ok(Math.abs(Math.hypot(c.x-a.x,c.y-a.y)-64)<1e-8);
 assert.equal(d.get('pin').attachment,null);assert.equal(d.get('pin').x,pin.x);assert.equal(d.get('line').endBinding,null);assert.equal(d.get('line').x2,line.x2);assert.equal(d.get('comment').callout?.binding,null);
 assert.equal(clipFollower(d.snapshot(),'b'),true);assert.equal(snap(anchorPoint(b,'top'),d.snapshot(),1)?.binding.objectId==='b',false);
 const ids=d.snapshot().map(o=>o.id),index=ids.indexOf('a');assert.deepEqual(ids.slice(index,index+4),['a','b','c',clip]);
 d.execute({operations:[{kind:'update',id:clip,patch:{clipOffset:0,clipAnchor:'top-right'}}]});assert.deepEqual(anchorPoint(d.get('a'),'top-right'),anchorPoint(d.get('b'),'top-right'));
 const before=d.snapshot(),rev=d.revision;assert.throws(()=>d.execute({operations:[{kind:'update',id:clip,patch:{clipOffset:1e12}}]}));assert.deepEqual(d.snapshot(),before);assert.equal(d.revision,rev);
 d.undo();assert.equal(d.get(clip).clipOffset,32);d.redo();assert.equal(d.get(clip).clipOffset,0);
});
test('drag any member or clip moves the bundle once; Alt peels a paper, rebases first, and never restores old bindings',()=>{
 const d=fixture(),clip=bundle(d),a=d.get('a');drag(d,'b',50,30);assert.equal(d.get('a').x,a.x+50);assert.equal(d.get('a').y,a.y+30);
 const moved=d.get('a');drag(d,clip,20,10);assert.equal(d.get('a').x,moved.x+20);
 const b=d.get('b');drag(d,'a',-80,50,true);assert.deepEqual(d.get(clip).clipMembers,['b','c']);assert.equal(d.get('b').x,b.x);assert.equal(d.get('b').y,b.y);assert.equal(clipFollower(d.snapshot(),'b'),false);
 assert.equal(d.get('pin').attachment,null);assert.equal(d.get('line').endBinding,null);
 const c=d.get('c');drag(d,'c',90,30,true);assert.deepEqual(d.get(clip).clipMembers,['b']);assert.equal(d.get('c').x,c.x+90);
 drag(d,'b',40,0,true);assert.throws(()=>d.get(clip));
});
test('delete any paper releases survivors in place; reordering moves the entire contiguous block; locked members block human movement',()=>{
 const d=fixture(),clip=bundle(d);d.execute({operations:[{kind:'reorder',id:'b',index:999}]});assert.deepEqual(d.snapshot().slice(-4).map(o=>o.id),['a','b','c',clip]);
 d.execute({operations:[{kind:'update',id:'c',patch:{locked:true}}]});assert.deepEqual(clipMoveOperations(d.snapshot(),['b'],10,20,false),[]);assert.deepEqual(unbundleOperations(d.snapshot(),['b']),[]);
 const survivors=['a','c'].map(id=>d.get(id));d.execute({operations:[{kind:'delete',id:'b'}]});assert.throws(()=>d.get(clip));assert.deepEqual(survivors.map(o=>[o.x,o.y]),['a','c'].map(id=>{const o=d.get(id);return[o.x,o.y]}));d.undo();assert.ok(d.get(clip));
 d.execute({operations:[{kind:'delete',id:clip}]});assert.equal(clipFor(d.snapshot(),'a'),undefined);
});
test('target filtering, duplicate ownership, standalone attachment and membership survive archive and whole-bundle copy',async()=>{
 const d=fixture();d.execute({operations:[{kind:'update',id:'c',patch:{locked:true}}]});const ops=bundleOperations(d.snapshot(),['outside','a','b','c','line']);d.execute({operations:ops});const clip=clipFor(d.snapshot(),'a')!;assert.deepEqual(clip.clipMembers,['a','b']);
 assert.deepEqual(bundleOperations(d.snapshot(),['a','line','outside']),[]);
 assert.throws(()=>d.execute({operations:[{kind:'add',object:{id:'double',type:'clip',clipMembers:['b']}}]}));
 const cb=new PartClipboard(),data=new Map<string,string>();cb.write({setData:(k,v)=>{data.set(k,v);},getData:k=>data.get(k)??''},clipGroup(d.snapshot(),clip.id));const ids=cb.paste(d);const copy=d.snapshot().find(o=>o.type==='clip'&&o.id!==clip.id)!;assert.equal(copy.clipMembers?.length,2);assert.ok(copy.clipMembers?.every(id=>ids.includes(id)));
 const saved=await decodeDeskFile(await encodeDeskFile(d));const restored=new Desk();restored.replaceDocument({objects:saved.objects,settings:saved.settings});assert.deepEqual(restored.list(),d.list());
 const free=new Desk();free.execute({operations:[{kind:'add',object:{id:'p',type:'text',x:200,y:100}},{kind:'add',object:{id:'clip',type:'clip',x:0,y:0,clipMembers:[]}}]});const empty=free.get('clip'),target=anchorPoint(free.get('p'),'top-left');drag(free,'clip',target.x-empty.x-empty.width/2,target.y-empty.y-empty.height/2);assert.deepEqual(free.get('clip').clipMembers,['p']);
});

test('clip art keeps its SVG center on each anchor and rotates in 45 degree steps', async()=>{
 const {clipAppearance}=await import('../src/clip-appearance');
 const d=fixture(),id=bundle(d);
 for(const style of ['binder','wire'] as const) for(const [i,anchor] of (['top','top-right','right','bottom-right','bottom','bottom-left','left','top-left'] as const).entries()) {
  d.execute({operations:[{kind:'update',id,patch:{clipStyle:style,clipAnchor:anchor,clipSize:96}}]});
  const clip=d.get(id),point=anchorPoint(d.get('a'),anchor),art=clipAppearance(clip);
  assert.equal(art.angle,i*45);
  assert.ok(Math.abs(clip.x+clip.width/2-point.x-art.insetX)<1e-8);
  assert.ok(Math.abs(clip.y+clip.height/2-point.y-art.insetY)<1e-8);
  assert.equal(clip.width,art.boundsWidth);assert.equal(clip.height,art.boundsHeight);
 }
});

test('clip locks toggle the whole bundle through patches and AI pointing, persist and block human structural edits',async()=>{
 const d=fixture(),id=bundle(d),ids=['a','b','c',id];
 d.execute({actor:'human',operations:[{kind:'update',id:'b',patch:{locked:true}}]});
 assert.ok(ids.every(id=>d.get(id).locked));
 const locked=d.snapshot();
 for(const operation of [
  {kind:'update',id:'a',patch:{width:500}},
  {kind:'update',id,patch:{clipOffset:200}},
  {kind:'update',id,patch:{clipMembers:['a']}},
  {kind:'delete',id}, {kind:'delete',id:'b'},
 ] as const) {assert.throws(()=>d.execute({actor:'human',operations:[operation as import('../src/model').Operation]}),/ロック/);assert.deepEqual(d.snapshot(),locked);}
 d.execute({actor:'human',operations:[{kind:'update',id:'a',patch:{text:'Editable'}}]});
 const archive=await decodeDeskFile(await encodeDeskFile(d)),restored=new Desk();restored.replaceDocument({objects:archive.objects,settings:archive.settings});assert.ok(ids.every(id=>restored.get(id).locked));
 d.point(['c']);const result=dispatch(d,{method:'lock',locked:false}) as {ids:string[]};assert.deepEqual(result.ids,ids);assert.ok(ids.every(id=>d.get(id).locked===false));
 d.undo();assert.ok(ids.every(id=>d.get(id).locked));d.redo();assert.ok(ids.every(id=>!d.get(id).locked));
 d.execute({operations:[{kind:'update',id,patch:{locked:true}},{kind:'update',id:'a',patch:{x:400}}]});assert.equal(d.get('a').x,400);
 const mixed=d.snapshot().map(object=>({...object,locked:object.id==='c'}));restored.replaceDocument({objects:mixed,settings:d.settingsSnapshot()});assert.ok(ids.every(id=>restored.get(id).locked));
});
