import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Desk } from '../src/model';
import { clipMembershipGuides } from '../src/clip-membership';

test('membership uses nearest rectangular anchor including disabled followers and distinguishes independent bundles',()=>{
 const d=new Desk();d.execute({operations:[
  ...['a','b','c','d','free'].map((id,i)=>({kind:'add' as const,object:{id,type:'text' as const,x:i*300,y:100,width:200,height:100,cornerRadius:40}})),
  {kind:'add',object:{id:'clip1',type:'clip',clipMembers:['a','b'],clipAnchor:'top-left',clipOffset:100}},
  {kind:'add',object:{id:'clip2',type:'clip',clipMembers:['c','d'],clipAnchor:'bottom-right',clipOffset:200}},
 ]});
 const scene=d.snapshot(),before=structuredClone(scene);
 const guides=clipMembershipGuides(scene,['a','b','d','free','clip1','b']);assert.equal(guides.length,3);
 const a=scene.find(o=>o.id==='a')!,guide=guides.find(g=>g.id==='a')!;
 assert.deepEqual(guide.start,{x:a.x,y:a.y}); // Rectangle corner, not inset rounded-text connector anchor.
 assert.equal(guides.find(g=>g.id==='b')!.clipId,'clip1');assert.equal(guides.find(g=>g.id==='d')!.clipId,'clip2');
 assert.deepEqual(clipMembershipGuides(scene,[]),[]);assert.deepEqual(scene,before);
 d.execute({operations:[{kind:'update',id:'a',patch:{x:400,y:600,width:1000,height:800}}]});
 const moved=clipMembershipGuides(d.snapshot(),['a','b']);assert.notDeepEqual(moved[0].end,guide.end);
 const clip=d.get('clip1');assert.deepEqual(moved[1].end,{x:clip.x+clip.width/2,y:clip.y+clip.height/2});
 d.execute({operations:[{kind:'delete',id:'clip1'}]});assert.deepEqual(clipMembershipGuides(d.snapshot(),['a','b']),[]);
});
