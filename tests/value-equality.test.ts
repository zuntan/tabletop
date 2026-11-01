import {test} from 'node:test';
import assert from 'node:assert/strict';
import {equalValue} from '../src/value-equality';
test('document comparisons include nested geometry, order, absent optionals and large material strings',()=>{
 const src='x'.repeat(2_000_000),a={objects:[{id:'a',x:1,src,binding:{anchor:'top'}}]};
 assert.equal(equalValue(a,structuredClone(a)),true);
 assert.equal(equalValue({a:undefined},{}),true);
 assert.equal(equalValue([1,2],[2,1]),false);
 assert.equal(equalValue(null,{}),false);assert.equal(equalValue([],{}),false);
 assert.equal(equalValue(a,{objects:[{...a.objects[0],x:2}]}),false);
 assert.equal(equalValue(a,{objects:[{...a.objects[0],binding:{anchor:'bottom'}}]}),false);
 assert.equal(equalValue(a,{objects:[{...a.objects[0],src:src+'x'}]}),false);
});
