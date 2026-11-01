import test from 'node:test';
import assert from 'node:assert/strict';
import {Desk,objectSchema} from '../src/model';
import {encodeDeskFile,decodeDeskFile} from '../src/desk-file';
import {MAX_ASSET_BYTES,MAX_MANIFEST_BYTES,MAX_DESK_BYTES} from '../src/data-limits';
import {bytesDataUrl} from '../src/binary-envelope';
import {zipSync,strToU8} from 'fflate';

test('decimal 10MB material boundary is enforced before adding to a desk',()=>{
 const src=bytesDataUrl(new Uint8Array(MAX_ASSET_BYTES),'image/png');assert.ok(objectSchema.safeParse({id:'boundary',type:'image',src}).success);
 assert.equal(objectSchema.safeParse({id:'large',type:'image',src:bytesDataUrl(new Uint8Array(MAX_ASSET_BYTES+1),'image/png')}).success,false);
});
test('3000 objects round-trip; a 3001st object is rejected atomically',async()=>{
 const desk=new Desk();desk.replaceDocument({objects:Array.from({length:3000},(_,i)=>({id:`n${i}`,type:'text',text:'x'})),settings:desk.settingsSnapshot()});
 const decoded=await decodeDeskFile(await encodeDeskFile(desk));assert.equal(decoded.objects.length,3000);const revision=desk.revision;
 assert.throws(()=>desk.execute({operations:[{kind:'add',object:{id:'overflow',type:'text'}}]}),/Object limit/);assert.equal(desk.revision,revision);assert.equal(desk.summary().count,3000);
});
test('oversized archive and manifest are rejected before document replacement',async()=>{
 await assert.rejects(decodeDeskFile(new Uint8Array(MAX_DESK_BYTES+1)),/250MB/);
 const bytes=zipSync({'manifest.json':strToU8(' '.repeat(MAX_MANIFEST_BYTES+1))});await assert.rejects(decodeDeskFile(bytes),/Expanded archive/);
});
