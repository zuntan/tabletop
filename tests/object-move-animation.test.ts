import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Desk, batchSchema } from '../src/model';
import { pointedMove, ObjectMoveAnimator } from '../src/object-move-animation';
import type { FrameScheduler } from '../src/camera-animation';

function fixture(){const d=new Desk();d.execute({operations:[
 {kind:'add',object:{id:'a',type:'text',x:100,y:100,callout:{x:80,y:150}}},
 {kind:'add',object:{id:'b',type:'text',x:400,y:100}},
 {kind:'add',object:{id:'line',type:'line',x:0,y:0,x2:800,y2:100,startBinding:{objectId:'a',anchor:'right'}}},
]});return d;}
const move=(id:string,x:number,y:number)=>({kind:'update' as const,id,patch:{x,y}});
test('only a pointed common position-only translation eases; content, resizing, unpointed and divergent moves stay instant',()=>{
 const d=fixture(),before=d.snapshot(),ops=[move('a',200,180),move('b',500,180)];d.execute({operations:ops,snap:'exact'});const after=d.snapshot();
 const flight=pointedMove(before,after,['a','b'],ops)!;assert.ok(flight);assert.equal(flight.durationMs,350);
 assert.equal(pointedMove(before,after,[],ops),null);assert.equal(pointedMove(before,after,['a'],ops),null);
 assert.equal(pointedMove(before,after,['a','b'],[{...ops[0],patch:{...ops[0].patch,text:'change'}},ops[1]]),null);
 assert.equal(pointedMove(before,after,['a','b'],[{...ops[0],patch:{width:500}},ops[1]]),null);
 assert.equal(pointedMove(before,after,['a','b'],[...ops,ops[0]]),null);
 const different=fixture(),original=different.snapshot();different.execute({operations:[move('a',200,100),move('b',600,100)],snap:'exact'});
 assert.equal(pointedMove(original,different.snapshot(),['a','b'],[move('a',200,100),move('b',600,100)]),null);
 const half=flight.at(.5),a=half.find(o=>o.id==='a')!,line=half.find(o=>o.id==='line')!;
 assert.ok(a.x>150&&a.x<200);assert.equal(line.x,a.x+a.width);assert.equal(line.x2,800);
 assert.equal(a.callout!.x,80);assert.deepEqual(flight.at(0),before);assert.deepEqual(flight.at(1),after);
 assert.equal(d.revision,2);d.undo();assert.deepEqual(d.snapshot(),before);
});
test('pointing at a clip permits moving its base and interpolates the complete bundle together',()=>{
 const d=fixture();d.execute({operations:[{kind:'add',object:{id:'clip',type:'clip',clipMembers:['a','b'],clipStyle:'wire'}}]});
 const before=d.snapshot(),a=d.get('a'),ops=[move('a',a.x+240,a.y+120)];d.execute({operations:ops,snap:'exact'});
 const flight=pointedMove(before,d.snapshot(),['clip'],ops)!;assert.ok(flight);
 const frame=flight.at(.4);for(const id of ['a','b','clip']) {const old=before.find(o=>o.id===id)!,now=frame.find(o=>o.id===id)!;assert.ok(Math.abs(now.x-old.x-(frame[0].x-before[0].x))<1e-8);}
});
function clock(){let id=0;const frames=new Map<number,(t:number)=>void>(),timers=new Map<number,()=>void>();const api:FrameScheduler={request:cb=>{frames.set(++id,cb);return id},cancel:id=>{frames.delete(id)},timeout:cb=>{timers.set(++id,cb);return id as unknown as ReturnType<typeof setTimeout>},clearTimeout:id=>{timers.delete(id as unknown as number)}};return{api,frames,timers,tick(t:number){const pending=[...frames.values()];frames.clear();pending.forEach(cb=>cb(t));}};}
test('completion, interruption and frame deadline settle once, clean up and show committed final state',async()=>{
 const d=fixture(),before=d.snapshot(),ops=[move('a',300,200)];d.execute({operations:ops,snap:'exact'});const after=d.snapshot(),flight=pointedMove(before,after,['a'],ops)!;
 const c=clock(),animator=new ObjectMoveAnimator(c.api);let shown=before,finishes=0;const finish=()=>{shown=after;finishes++};
 let promise=animator.run(flight,scene=>{shown=scene},finish);c.tick(0);c.tick(150);assert.notDeepEqual(shown,after);animator.finish();assert.equal(await promise,'interrupted');assert.deepEqual(shown,after);c.tick(1000);assert.equal(finishes,1);assert.equal(c.frames.size,0);assert.equal(c.timers.size,0);
 promise=animator.run(flight,scene=>{shown=scene},finish);c.tick(2000);c.tick(2350);assert.equal(await promise,'completed');assert.deepEqual(shown,after);
 promise=animator.run(flight,scene=>{shown=scene},finish);[...c.timers.values()].forEach(cb=>cb());assert.equal(await promise,'interrupted');assert.deepEqual(shown,after);assert.equal(animator.active,false);assert.equal(c.timers.size,0);
 assert.equal(d.revision,2);
});

test('per-command duration is validated atomically, defaults to 350, accepts 600 and zero skips easing without persisting',()=>{
 const d=fixture(),before=d.snapshot(),ops=[move('a',200,100)];
 for(const value of [-1,2001,Infinity,NaN,'600']) {assert.equal(batchSchema.safeParse({operations:ops,durationMs:value}).success,false);assert.throws(()=>d.execute({operations:ops,durationMs:value as number}));assert.deepEqual(d.snapshot(),before);}
 d.execute({operations:ops,durationMs:600,snap:'exact'});const after=d.snapshot();
 assert.equal(pointedMove(before,after,['a'],ops)!.durationMs,350);
 assert.equal(pointedMove(before,after,['a'],ops,600)!.durationMs,600);
 assert.equal(pointedMove(before,after,['a'],ops,2000)!.durationMs,2000);
 assert.equal(pointedMove(before,after,['a'],ops,0),null);
 assert.ok(after.every(object=>!('durationMs' in object)));assert.equal('durationMs' in d.settingsSnapshot(),false);
 d.undo();assert.deepEqual(d.snapshot(),before);
});
