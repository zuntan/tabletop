import assert from 'node:assert/strict';
import {test} from 'node:test';
import {reactionPlacements,reactionPositions} from '../src/reaction-layout';

test('eight reaction placements stay outside the body and wrap away from it',()=>{
 for(const placement of reactionPlacements){
  const points=reactionPositions(300,200,24,placement);
  const horizontal=placement.endsWith('-right')||placement.endsWith('-left');
  const top=placement.startsWith('top'),left=placement.includes('-left-');
  for(const p of points){
   if(horizontal)assert.ok(top?p.y+24<=-8:p.y>=208);
   else assert.ok(left?p.x+24<=-8:p.x>=308);
  }
  if(horizontal){assert.equal(points[0].x,left?0:108);assert.equal(points[1].x-points[0].x,28);assert.equal(points[7].y-points[0].y,top?-28:28);}
  else{assert.equal(points[0].y,top?0:8);assert.equal(points[1].y-points[0].y,28);assert.equal(points[7].x-points[0].x,left?-28:28);}
 }
 assert.deepEqual(reactionPositions(100,100,0),[]);
});

test('left/up growth reverses within each seven-mark band, including a short final band',()=>{
 for(const placement of ['bottom-right-left','bottom-right-up','top-right-left','bottom-left-up'] as const){
  for(const count of [1,3,7,8,10,14,15,43]){
   const points=reactionPositions(300,200,count,placement),horizontal=placement.endsWith('left');
   for(let start=0;start<count;start+=7){
    const band=points.slice(start,start+7);
    for(let i=1;i<band.length;i++)assert.equal(horizontal?band[i].x-band[i-1].x:band[i].y-band[i-1].y,28);
    assert.equal(horizontal?band.at(-1)!.x:band.at(-1)!.y,horizontal?276:176);
   }
  }
 }
});
