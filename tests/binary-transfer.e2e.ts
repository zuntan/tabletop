import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openTestDesk} from './desk-browser';
import {decodeDeskFile} from '../src/desk-file';

test('archives larger than the old JSON limit save/load with binary chunks and keep guards',{timeout:120000},async()=>{
 const root=await mkdtemp(join(tmpdir(),'tabletop-binary-e2e-'));const desk=await openTestDesk('binary-large');
 try{
  const {call,page}=desk;
  for(let i=0;i<3;i++){
   const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><!--${String(i).repeat(7_000_000)}--><rect width="10" height="10"/></svg>`;
   await call('desk_asset_import',{id:`image-${i}`,source:{svg},x:i*350,y:0});
  }
  const summary=await call('desk_summary');assert.equal(summary.count,3);
  const path=join(root,'large.tabletop');const saved=await call('desk_save',{path});assert.ok(saved.bytes>20_000_000);
  const file=await readFile(path);assert.equal(file.length,saved.bytes);const decoded=await decodeDeskFile(file);assert.equal(decoded.objects.length,3);
  await call('desk_execute',{operations:[{kind:'delete',id:'image-2'}]});const modified=await call('desk_summary');
  const loaded=await call('desk_load',{path,confirm:true,expectedSessionId:modified.sessionId,expectedRevision:modified.revision});assert.equal(loaded.count,3);
  assert.equal((await call('desk_get',{id:'image-2'})).text,'image-2');
  assert.equal(await page.locator('#connection').textContent(),'MCP接続済み');assert.deepEqual(desk.errors,[]);
 }finally{await desk.close();await rm(root,{recursive:true,force:true});}
});
