import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BellWait} from '../src/bell-wait';
test('bell cursors preserve missed presses and wait/timeout do not acknowledge the lamp',async()=>{
 const bell=new BellWait();
 const idle=await bell.wait(0,0);assert.equal(idle.status,'timeout');
 const wait=bell.wait(0,1000,bell.epoch);const ids=['memo'];bell.ring(ids);ids.push('other');
 const result=await wait;assert.equal(result.status,'bell');assert.deepEqual(result.ids,['memo']);assert.equal(bell.state().pending,true);
 assert.equal((await bell.wait(0,0)).status,'bell');assert.equal((await bell.wait(1,0)).status,'timeout');assert.equal(bell.state().pending,true);
 bell.acknowledge();assert.equal(bell.state().pending,false);assert.equal((await bell.wait(1,0,'old-epoch')).status,'reset');
});
test('bell waits clean up on caller cancellation, disconnection and the concurrent bound',async()=>{
 const bell=new BellWait(),controller=new AbortController();
 const cancelled=bell.wait(0,1000,undefined,controller.signal);controller.abort();await assert.rejects(cancelled,/cancelled/);assert.equal(bell.state().waiting,0);
 const waits=Array.from({length:8},()=>bell.wait(0,1000));await assert.rejects(bell.wait(0,1000),/eight/);
 bell.disconnect();assert.ok((await Promise.all(waits)).every(result=>result.status==='disconnected'));assert.equal(bell.state().waiting,0);
});

test('bell snapshots include press-time text and only bell retrieval collects its draft',async()=>{
 const collected:{text:string;draftVersion:number}[]=[];const bell=new BellWait(()=>{},note=>collected.push(note));
 bell.ring(['memo'],'first',4);bell.acknowledge();assert.deepEqual(collected,[]);
 const result=await bell.wait(0,0);assert.equal(result.text,'first');assert.deepEqual(collected,[{text:'first',draftVersion:4}]);
 const timeout=await bell.wait(result.sequence,0);assert.equal(timeout.text,undefined);assert.equal(collected.length,1);
});
