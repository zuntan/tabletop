import test from 'node:test';
import assert from 'node:assert/strict';
import {Desk} from '../src/model';
import {gestureOperations,gesturePreview,type Gesture} from '../src/diagram-gestures';
import {anchorPoint} from '../src/geometry';

test('wayfinder drag chooses the nearest of four source anchors, allowing inside and outside placement',()=>{
 const d=new Desk();d.execute({snap:'exact',operations:[{kind:'add',object:{id:'card',type:'text',x:300,y:300,width:200,height:200}},{kind:'add',object:{id:'go',type:'wayfinder',x:0,y:0,width:72,height:72}}]});
 const scene=d.snapshot(),go=d.get('go');
 const gesture:Gesture={mode:'move',start:{x:0,y:0},screen:{x:0,y:0},originals:[go],scene,preview:scene,revision:d.revision,camera:{x:0,y:0},additive:[],grid:false};
 for(const [x,y,side]of [[364,498,'top'],[364,430,'bottom'],[498,364,'left'],[430,364,'right']] as const){
  const result=gesturePreview(gesture,{x,y},1),attached=result.find(o=>o.id==='go')!;
  assert.equal(attached.attachmentAnchor,side);assert.equal(attached.attachment?.objectId,'card');assert.deepEqual(anchorPoint(attached,side),anchorPoint(d.get('card'),attached.attachment!.anchor));
 }
 const alt=gestureOperations({...gesture,detach:true},{x:364,y:498},1).find(op=>op.kind==='update'&&op.id==='go');
 assert.equal(alt?.kind==='update'?alt.patch.attachment:undefined,undefined);
});
