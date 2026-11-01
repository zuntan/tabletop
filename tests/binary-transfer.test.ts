import test from 'node:test';
import assert from 'node:assert/strict';
import {BinaryTransfer,memorySink} from '../src/binary-transfer';
import {packEnvelope,unpackEnvelope,bytesDataUrl,dataBytes} from '../src/binary-envelope';
import {temporaryTransferSink} from '../src/binary-transfer-node';
import {sha256Hex} from '../src/portable-crypto';
import {MAX_ASSET_BYTES,MAX_DESK_BYTES,MAX_MANIFEST_BYTES,MAX_WS_BYTES} from '../src/data-limits';

test('binary envelope removes base64 expansion, deduplicates and preserves metadata',()=>{
 const raw=new Uint8Array(2_000_000).fill(91),src=bytesDataUrl(raw,'image/png');
 const value={id:'result',result:{objects:[{src},{src}],base64:src.split(',')[1]}};
 const packed=packEnvelope(value);assert.ok(packed.length<4_001_000);assert.deepEqual(unpackEnvelope(packed),value);
 const corrupted=packed.slice();new DataView(corrupted.buffer).setUint32(0,MAX_MANIFEST_BYTES+1);assert.throws(()=>unpackEnvelope(corrupted));
 assert.throws(()=>packEnvelope({dataUrl:bytesDataUrl(new Uint8Array(MAX_ASSET_BYTES+1),'image/png')}),/10MB/);
});
test('stop-and-wait transfers a 25MB binary file both directions with bounded frames and disk sink',async()=>{
 let a!:BinaryTransfer,b!:BinaryTransfer;const receivedA:any[]=[],receivedB:any[]=[],frames:number[]=[];let outstanding=0;
 a=new BinaryTransfer(data=>{if(typeof data!=='string'){frames.push(data.length);outstanding++;assert.equal(outstanding,1);}queueMicrotask(()=>void b.receive(data));},v=>receivedA.push(v));
 b=new BinaryTransfer(data=>{if(typeof data==='string'&&JSON.parse(data).type==='binary_ack'&&JSON.parse(data).sequence>=0)outstanding--;queueMicrotask(()=>void a.receive(data));},v=>receivedB.push(v),temporaryTransferSink);
 try{const value={id:'file',result:{archiveDataUrl:bytesDataUrl(new Uint8Array(25_000_000).fill(3))}};await a.send(value);assert.deepEqual(receivedB,[value]);assert.ok(frames.length>=25);assert.ok(frames.every(n=>n<=1_000_040&&n<MAX_WS_BYTES));await b.send({id:'reply',result:{base64:bytesDataUrl(new Uint8Array(2_000_000).fill(8)).split(',')[1]}});assert.equal(dataBytes('data:application/pdf;base64,'+receivedA[0].result.base64).length,2_000_000);}finally{a.close();b.close();}
});
test('out-of-order chunks and checksum mismatch cancel and discard partial data',async()=>{
 const controls:any[]=[];let disposed=0,delivered=0;
 const receiver=new BinaryTransfer(v=>{assert.equal(typeof v,'string');controls.push(JSON.parse(v as string));},()=>delivered++,async()=>{const sink=await memorySink();return{...sink,async dispose(){disposed++;await sink.dispose();}};});
 const id=crypto.randomUUID(),payload=packEnvelope({ok:true});
 const begin=()=>receiver.receive(JSON.stringify({type:'binary_begin',id,size:payload.length,hash:'0'.repeat(64)}));
 const frame=(sequence:number)=>{const bytes=new Uint8Array(40+payload.length);bytes.set(new TextEncoder().encode(id));new DataView(bytes.buffer).setUint32(36,sequence);bytes.set(payload,40);return bytes;};
 try{await begin();await receiver.receive(frame(1));assert.equal(disposed,1);assert.equal(controls.at(-1).type,'binary_cancel');await begin();await receiver.receive(frame(0));await receiver.receive(JSON.stringify({type:'binary_end',id}));assert.equal(disposed,2);assert.equal(delivered,0);assert.match(controls.at(-1).error,/checksum/);}finally{receiver.close();}
});
test('idle timeouts and disconnect reject without replay; declared sizes are bounded',async()=>{
 let sent=0;const sender=new BinaryTransfer(()=>sent++,()=>{},memorySink,()=>{},20);
 await assert.rejects(sender.send({base64:bytesDataUrl(new Uint8Array(100)).split(',')[1]}),/no progress/);assert.equal(sent,2);sender.close();
 const controls:any[]=[];const receiver=new BinaryTransfer(v=>controls.push(JSON.parse(v as string)),()=>{});
 await receiver.receive(JSON.stringify({type:'binary_begin',id:crypto.randomUUID(),size:MAX_DESK_BYTES+MAX_MANIFEST_BYTES+5,hash:sha256Hex(new Uint8Array())}));assert.equal(controls[0].type,'binary_cancel');receiver.close();
});

test('disconnect during a chunk rejects and disposes receiver state',async()=>{
 let sender!:BinaryTransfer,receiver!:BinaryTransfer,disposed=0;
 sender=new BinaryTransfer(data=>{queueMicrotask(()=>{if(typeof data!=='string'){sender.close();receiver.close();}else void receiver.receive(data);});},()=>{});
 receiver=new BinaryTransfer(data=>queueMicrotask(()=>void sender.receive(data)),()=>{assert.fail('must not deliver partial data');},async()=>{const sink=await memorySink();return{...sink,async dispose(){disposed++;await sink.dispose();}};});
 await assert.rejects(sender.send({dataUrl:bytesDataUrl(new Uint8Array(2_000_000),'image/png')}),/Connection closed/);
 await new Promise(resolve=>setTimeout(resolve,0));assert.equal(disposed,1);receiver.close();
});

test('final verification is distinct from idle network time',async()=>{
 let sender!:BinaryTransfer,receiver!:BinaryTransfer;const delivered:any[]=[];
 sender=new BinaryTransfer(data=>queueMicrotask(()=>void receiver.receive(data)),()=>{},memorySink,()=>{},20);
 receiver=new BinaryTransfer(data=>queueMicrotask(()=>void sender.receive(data)),value=>delivered.push(value),async()=>{const sink=await memorySink();return{...sink,async finish(){await new Promise(resolve=>setTimeout(resolve,60));return sink.finish();}};},()=>{},20);
 try{await sender.send({dataUrl:bytesDataUrl(new Uint8Array(100),'image/png')});assert.equal(delivered.length,1);}finally{sender.close();receiver.close();}
});
