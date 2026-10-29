import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Desk,dispatch } from '../src/model';
import { anchorsFor, anchorPoint } from '../src/geometry';
import { wayfinderRoute, lineRoute, measuredRoute } from '../src/wayfinder-route';
import { travelDuration,wayfinderDuration,wayfinderProgress,tourSpeed } from '../src/wayfinder-travel';
import { wayfinderDirection } from '../src/wayfinder-drawing';
import { PartClipboard } from '../src/part-clipboard';
import { encodeDeskFile, decodeDeskFile } from '../src/desk-file';

function fixture(){const desk=new Desk();desk.execute({operations:[
  {kind:'add',object:{id:'a',type:'text',x:0,y:100,width:200,height:100}},
  {kind:'add',object:{id:'b',type:'text',x:1200,y:600,width:200,height:100}},
  {kind:'add',object:{id:'go',type:'wayfinder',width:72,height:72,attachment:{objectId:'a',anchor:'right'}}},
  {kind:'add',object:{id:'l1',type:'line',x:0,y:0,x2:700,y2:150,startBinding:{objectId:'go',anchor:'right'},endJunction:'j',junctionRounding:48}},
  {kind:'add',object:{id:'l2',type:'line',x:700,y:150,x2:1200,y2:650,startJunction:'j',endBinding:{objectId:'b',anchor:'left'},junctionRounding:48}},
]});return desk;}

test('wayfinder bottom attachment follows its card; four ports share one route line',()=>{
  const desk=fixture(),go=desk.get('go');assert.deepEqual(anchorsFor(go),['top','right','bottom','left']);
  assert.deepEqual(anchorPoint(go,'bottom'),anchorPoint(desk.get('a'),'right'));
  assert.equal(wayfinderDirection(desk.snapshot(),'go'),'right');
  desk.execute({operations:[{kind:'update',id:'l1',patch:{startBinding:{objectId:'go',anchor:'top'}}}]});
  assert.equal(wayfinderDirection(desk.snapshot(),'go'),'top');
  desk.execute({operations:[{kind:'update',id:'l1',patch:{startBinding:{objectId:'go',anchor:'left'}}}]});
  assert.equal(wayfinderDirection(desk.snapshot(),'go'),'left');
  desk.execute({operations:[{kind:'update',id:'a',patch:{x:50,width:300}}]});
  assert.deepEqual(anchorPoint(desk.get('go'),'bottom'),anchorPoint(desk.get('a'),'right'));
  assert.throws(()=>desk.execute({operations:[{kind:'add',object:{id:'bad',type:'line',startBinding:{objectId:'go',anchor:'top'}}}]}),/1本/);
  desk.execute({operations:[{kind:'update',id:'l1',patch:{startBinding:{objectId:'go',anchor:'bottom'}}}]});
  assert.equal(wayfinderDirection(desk.snapshot(),'go'),'bottom');
  assert.throws(()=>desk.execute({operations:[{kind:'update',id:'l1',patch:{startBinding:{objectId:'go',anchor:'top-left'}}}]}),/4点/);
  assert.throws(()=>desk.execute({operations:[{kind:'add',object:{id:'file',type:'file',fileMembers:['go']}}]}),/入れられない/);
  desk.execute({operations:[{kind:'delete',id:'a'}]});assert.equal(desk.get('go').attachment,null);
});

test('explicit route follows rounded connected segments, ignores crossing lines and arrow direction, and lands at the card center',()=>{
  const desk=fixture();desk.execute({operations:[
    {kind:'update',id:'l1',patch:{startMarker:'arrow'}},
    {kind:'add',object:{id:'crossing',type:'line',x:700,y:0,x2:700,y2:800}},
  ]});
  const route=wayfinderRoute(desk.snapshot(),'go');assert.deepEqual(route.lineIds,['l1','l2']);assert.equal(route.destinationId,'b');
  assert.deepEqual(route.points.at(-1),{x:1300,y:650});assert.ok(route.points.length>20);
  assert.equal(route.points.some(p=>p.x===700&&p.y===150),false,'rounded corner must not cut through the logical vertex');
  desk.execute({operations:[{kind:'update',id:'l2',patch:{endBinding:null}}]});
  assert.equal(wayfinderRoute(desk.snapshot(),'go').destinationId,undefined);
});

test('branches return choices at the junction and loops stop safely',()=>{
  const departure=fixture();departure.execute({operations:[
    {kind:'update',id:'l1',patch:{startJunction:'departure'}},
    {kind:'add',object:{id:'at-start',type:'line',startJunction:'departure',x2:500,y2:700}},
  ]});
  assert.equal(wayfinderRoute(departure.snapshot(),'go').branch?.choices.length,2);
  const desk=fixture();desk.execute({operations:[{kind:'add',object:{id:'branch',type:'line',x:700,y:150,x2:800,y2:400,startJunction:'j'}}]});
  const branch=wayfinderRoute(desk.snapshot(),'go').branch!;assert.deepEqual(branch.choices,[{lineId:'l2',from:'start'},{lineId:'branch',from:'start'}]);
  desk.execute({operations:[{kind:'delete',id:'branch'},{kind:'update',id:'l2',patch:{endBinding:null,endJunction:'loop'}},
    {kind:'update',id:'l1',patch:{startJunction:'loop'}}]});
  assert.ok(wayfinderRoute(desk.snapshot(),'go').branch);
  assert.equal(lineRoute(desk.snapshot(),'l1','start').loop,true);
});

test('a receiving wayfinder arrives at its attached object and permits reverse travel',()=>{
  const desk=new Desk();desk.execute({operations:[
    {kind:'add',object:{id:'a',type:'text',x:0,y:100,width:200,height:100}},
    {kind:'add',object:{id:'b',type:'text',x:2000,y:100,width:200,height:100}},
    {kind:'add',object:{id:'go',type:'wayfinder',attachment:{objectId:'a',anchor:'right'}}},
    {kind:'add',object:{id:'back',type:'wayfinder',attachment:{objectId:'b',anchor:'left'}}},
    {kind:'add',object:{id:'l',type:'line',startBinding:{objectId:'go',anchor:'right'},endBinding:{objectId:'back',anchor:'left'}}},
  ]});
  assert.equal(wayfinderRoute(desk.snapshot(),'go').destinationId,'b');
  assert.equal(wayfinderRoute(desk.snapshot(),'back').destinationId,'a');
});

test('arc length traversal is independent of segment count and long trips have a duration cap',()=>{
  const a=measuredRoute([{x:0,y:0},{x:100,y:0}]),b=measuredRoute([{x:0,y:0},{x:1,y:0},{x:30,y:0},{x:100,y:0}]);
  for(const t of [0,.1,.5,1])assert.deepEqual(a.at(t),b.at(t));
  assert.equal(travelDuration(1e12,8),5000);assert.ok(travelDuration(100,1)<travelDuration(10000,1));
});

test('tour moves at constant screen speed without the move time cap',()=>{
  for(const zoom of [.25,1,2]){
    const duration=wayfinderDuration(10000,zoom,'tour');
    assert.ok(duration>5000);
    assert.equal(10000*zoom/(duration/1000),tourSpeed);
    for(const t of [.1,.25,.5,.75,.9])assert.equal(wayfinderProgress(t,'tour'),t);
  }
  assert.equal(wayfinderDuration(1e12,8,'move'),5000);
  assert.ok(wayfinderProgress(.1,'move')<.1);
});

test('wayfinder attachments and routes survive copy, archive and Undo',async()=>{
  const desk=fixture(),clipboard=new PartClipboard(),values=new Map<string,string>();
  desk.execute({operations:[{kind:'update',id:'go',patch:{wayfinderMode:'tour',attachmentAnchor:'top'}}]});
  assert.throws(()=>desk.execute({operations:[{kind:'update',id:'a',patch:{wayfinderMode:'tour'}}]}),/only to wayfinders/);
  clipboard.write({setData:(k,v)=>{values.set(k,v);},getData:k=>values.get(k)??''},desk.snapshot());
  const ids=clipboard.paste(desk),go=ids.map(id=>desk.get(id)).find(o=>o.type==='wayfinder')!;
  assert.ok(go.attachment&&go.attachment.objectId!=='a');assert.ok(wayfinderRoute(desk.snapshot(),go.id).destinationId!=='b');
  assert.equal(go.wayfinderMode,'tour');
  const decoded=await decodeDeskFile(await encodeDeskFile(desk));
  assert.deepEqual(decoded.objects.find(o=>o.id===go.id)?.attachment,go.attachment);assert.equal(decoded.objects.find(o=>o.id===go.id)?.attachmentAnchor,'top');
  assert.equal(decoded.objects.find(o=>o.id===go.id)?.wayfinderMode,'tour');
  desk.undo();assert.throws(()=>desk.get(go.id));
  clipboard.write({setData:(k,v)=>{values.set(k,v);},getData:k=>values.get(k)??''},[desk.get('go')]);
  assert.equal(desk.get(clipboard.paste(desk)[0]).attachment,null);
});

test('AI start dispatch is strict, calls the browser bridge and leaves document state unchanged',()=>{
  const desk=fixture(),revision=desk.revision,snapshot=desk.snapshot(),selection=desk.selected();
  const camera={get:()=>({}),move:()=>({}),wayfinderStart:(input:{id?:string})=>({...input,status:'started'})};
  assert.deepEqual(dispatch(desk,{method:'wayfinder_start',id:'go'},camera),{id:'go',status:'started'});
  assert.throws(()=>dispatch(desk,{method:'wayfinder_start',id:'go',speed:100},camera));
  assert.throws(()=>dispatch(desk,{method:'wayfinder_start',id:'go'},{get:()=>({}),move:()=>({})}),/unavailable/);
  assert.equal(desk.revision,revision);assert.deepEqual(desk.snapshot(),snapshot);assert.deepEqual(desk.selected(),selection);
});

test('raw line travel starts at either endpoint and validates ambiguous inputs',()=>{
 const desk=fixture();assert.equal(lineRoute(desk.snapshot(),'l1','start').destinationId,'b');assert.equal(lineRoute(desk.snapshot(),'l2','end').destinationId,'a');
 const camera={get:()=>({}),move:()=>({}),wayfinderStart:(input:unknown)=>input};
 assert.deepEqual(dispatch(desk,{method:'wayfinder_start',lineId:'l1',from:'end',mode:'tour'},camera),{lineId:'l1',from:'end',mode:'tour'});
 for(const input of [{},{id:'go',lineId:'l1',from:'start'},{lineId:'l1'},{id:'go',from:'end'}])assert.throws(()=>dispatch(desk,{method:'wayfinder_start',...input},camera));
});

test('all four source anchors attach to any target side, including a shared route port, and follow resizing',()=>{
 for(const source of ['top','right','bottom','left'] as const)for(const target of ['top','right','bottom','left'] as const){
  const d=new Desk();d.execute({snap:'exact',operations:[
   {kind:'add',object:{id:'card',type:'text',x:100,y:200,width:300,height:200}},
   {kind:'add',object:{id:'go',type:'wayfinder',width:72,height:72,attachment:{objectId:'card',anchor:target},attachmentAnchor:source}},
   {kind:'add',object:{id:'road',type:'line',startBinding:{objectId:'go',anchor:source},x2:900,y2:1000}}
  ]});
  assert.deepEqual(anchorPoint(d.get('go'),source),anchorPoint(d.get('card'),target));
  assert.deepEqual({x:d.get('road').x,y:d.get('road').y},anchorPoint(d.get('card'),target));
  d.execute({operations:[{kind:'update',id:'card',patch:{x:200,width:500}},{kind:'update',id:'go',patch:{width:100,height:120}}]});
  assert.deepEqual(anchorPoint(d.get('go'),source),anchorPoint(d.get('card'),target));
  assert.equal(wayfinderDirection(d.snapshot(),'go'),source);
 }
});
