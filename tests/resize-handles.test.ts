import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Desk, objectSchema } from '../src/model';
import { resizeHandles, resizePatch, type ResizeHandle } from '../src/resize-handles';
import { gestureOperations, type Gesture } from '../src/diagram-gestures';

const object = objectSchema.parse({id: 'a', type: 'text', x: 13, y: 17, width: 200, height: 100});
test('resize handles use screen dimensions with only one or eight points', () => {
  assert.equal(resizeHandles(object, 1).length, 8);
  assert.deepEqual(resizeHandles(object, .5), [{handle:'se', x:213, y:117}]);
  assert.equal(resizeHandles({...object, width:72, height:72}, 1).length, 8);
  assert.equal(resizeHandles({...object, width:71, height:300}, 1).length, 1);
});
test('all eight directions keep the opposite edges fixed and edges affect one axis', () => {
  for (const handle of ['nw','n','ne','e','se','s','sw','w'] as ResizeHandle[]) {
    const patch = resizePatch(object, handle, {x:30,y:20});
    const result = {...object,...patch};
    assert.equal(result.x, handle.includes('w') ? 43 : 13);
    assert.equal(result.y, handle.includes('n') ? 37 : 17);
    assert.equal(result.width, handle.includes('w') ? 170 : handle.includes('e') ? 230 : 200);
    assert.equal(result.height, handle.includes('n') ? 80 : handle.includes('s') ? 120 : 100);
    if(handle.includes('w')) assert.equal(result.x+result.width,213);
    if(handle.includes('n')) assert.equal(result.y+result.height,117);
  }
});
test('grid snaps dragged axes only and crossings clamp without flipping', () => {
  assert.deepEqual(resizePatch(object,'w',{x:20,y:99},true),{x:24,width:189});
  assert.deepEqual(resizePatch(object,'n',{x:99,y:20},true),{y:48,height:69});
  assert.deepEqual(resizePatch(object,'nw',{x:900,y:900}),{x:212,y:116,width:1,height:1});
  assert.deepEqual(resizePatch(object,'se',{x:-900,y:-900}),{width:1,height:1});
});
test('ruler resize normalization preserves the opposite edge at minimum length', () => {
  const ruler = objectSchema.parse({id:'r',type:'ruler',x:13,y:17,width:36,height:400,rulerAxis:'vertical'});
  const next={...ruler,...resizePatch(ruler,'n',{x:0,y:390})};
  assert.equal(next.height,120); assert.equal(next.y+next.height,417);
});
test('gesture direction is optional for legacy southeast resizing; locked and filed remain protected', () => {
  const gesture: Gesture={mode:'resize',start:{x:0,y:0},screen:{x:0,y:0},camera:{x:0,y:0},originals:[object],scene:[object],preview:[object],revision:0,additive:[]};
  assert.deepEqual(gestureOperations(gesture,{x:30,y:20},1),[{kind:'update',id:'a',patch:{width:230,height:120}}]);
  assert.deepEqual(gestureOperations({...gesture,resizeHandle:'w'},{x:30,y:20},1),[{kind:'update',id:'a',patch:{x:43,width:170}}]);
  assert.deepEqual(gestureOperations({...gesture,originals:[{...object,locked:true}]},{x:30,y:20},1),[]);
  const file=objectSchema.parse({id:'f',type:'file',x:0,y:0,width:400,height:400,fileMembers:['a']});
  assert.deepEqual(gestureOperations({...gesture,scene:[file,object]},{x:30,y:20},1),[]);
});
test('left resize preserves clip reflow, ruler membership, Undo, and connector resolution', () => {
  for (const owner of ['clip','ruler'] as const) {
    const desk=new Desk();
    desk.execute({snap:'exact',operations:[
      {kind:'add',object:{...object,id:'a'}},
      {kind:'add',object:{...object,id:'b',x:400}},
      {kind:'add',object:owner==='clip'
        ? {id:'owner',type:'clip',x:0,y:0,clipMembers:['a','b'],clipAnchor:'top-left',clipOffsetMode:'percent',clipOffsetPercent:50}
        : {id:'owner',type:'ruler',x:-23,y:17,width:36,height:400,rulerMembers:[{id:'a',side:'after'},{id:'b',side:'after'}],rulerMode:'gap'}},
    ]});
    const before=desk.snapshot(), a=desk.get('a');
    const g:Gesture={mode:'resize',resizeHandle:'w',start:{x:0,y:0},screen:{x:0,y:0},camera:{x:0,y:0},originals:[a],scene:before,preview:before,revision:desk.revision,additive:[]};
    desk.execute({snap:'exact',actor:'human',operations:gestureOperations(g,{x:-40,y:0},1)});
    assert.equal(desk.get('a').width,a.width+40);
    assert.equal(owner==='clip'?desk.get('owner').clipMembers?.length:desk.get('owner').rulerMembers?.length,2);
    if(owner==='clip') assert.equal(desk.get('b').x,desk.get('a').x+desk.get('a').width*.5);
    else assert.equal(desk.get('a').x,desk.get('owner').x+36);
    const after=desk.snapshot();desk.undo();assert.deepEqual(desk.snapshot(),before);desk.redo();assert.deepEqual(desk.snapshot(),after);
  }
});
