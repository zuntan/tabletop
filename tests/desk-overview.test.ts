import assert from 'node:assert/strict';
import {test} from 'node:test';
import {overviewLayout,overviewUnion,offscreenDirections} from '../src/desk-overview-values';

test('only fully offscreen objects indicate directions, including diagonal islands',()=>{
 const view={x:0,y:0,width:100,height:100};
 assert.equal(offscreenDirections([{x:-5,y:10,width:20,height:20}],view),'');
 assert.equal(offscreenDirections([{x:10,y:10,width:20,height:20}],view),'');
 assert.equal(offscreenDirections([{x:-20,y:110,width:10,height:10}],view),'← ↓');
 assert.equal(offscreenDirections([{x:-20,y:-20,width:10,height:10},{x:110,y:110,width:10,height:10}],view),'← ↑ → ↓');
 assert.equal(offscreenDirections([],view),'');
});
test('overview projects both rectangles together when neither contains the other',()=>{
 const all={x:-400,y:-100,width:1000,height:100},view={x:-50,y:-500,width:100,height:1000};
 const projected=overviewLayout(all,view);
 for(const rect of [projected.all!,projected.view]){
  assert.ok(rect.x>=5.9&&rect.y>=5.9);assert.ok(rect.x+rect.width<=158.1);assert.ok(rect.y+rect.height<=106.1);
 }
 assert.ok(projected.all!.x<projected.view.x);assert.ok(projected.all!.width>projected.view.width);
 assert.ok(projected.view.y<projected.all!.y);assert.ok(projected.view.height>projected.all!.height);
 assert.equal(overviewUnion([]),null);assert.equal(overviewLayout(null,view).all,null);
 const point=overviewLayout({x:0,y:0,width:0,height:0},{x:0,y:0,width:0,height:0});
 assert.ok(Object.values(point.view).every(Number.isFinite));
});
