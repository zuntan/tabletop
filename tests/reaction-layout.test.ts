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
  if(horizontal){assert.equal(points[0].x,left?0:276);assert.equal(points[1].x-points[0].x,left?28:-28);assert.equal(points[7].y-points[0].y,top?-28:28);}
  else{assert.equal(points[0].y,top?0:176);assert.equal(points[1].y-points[0].y,top?28:-28);assert.equal(points[7].x-points[0].x,left?-28:28);}
 }
 assert.deepEqual(reactionPositions(100,100,0),[]);
});
