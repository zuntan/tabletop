import {test} from 'node:test';
import assert from 'node:assert/strict';
import {particleMesh} from '../src/stationery-delete-animation';

test('particle mesh covers the whole raster once and stays bounded for extreme aspect ratios',()=>{
  for(const [width,height] of [[400,300],[100000,1],[1,100000],[1,1]]){
    const pieces=particleMesh({x:100,y:200,width,height});
    assert.ok(pieces.length<=280&&pieces.length>=2);
    let area=0;
    for(const {points:[a,b,c]} of pieces){
      area+=Math.abs((b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y))/2;
      for(const p of [a,b,c])assert.ok(p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1);
    }
    assert.ok(Math.abs(area-1)<1e-10);
    assert.deepEqual(pieces,particleMesh({x:0,y:0,width,height}));
  }
});
