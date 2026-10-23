import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Desk,dispatch} from '../src/model';
import {DeskFileStore} from '../src/desk-file-store';
import {DeskFileService} from '../src/desk-file-service';
import {DeskFileHistory} from '../src/desk-file-history';
import {encodeDeskFile,decodeDeskFile} from '../src/desk-file';

test('normal save resolves unicode paths, overwrites atomically and keeps old bytes on rejected writes',async()=>{
 const root=await mkdtemp(join(tmpdir(),'tabletop-files-'));const service=new DeskFileService(new DeskFileStore(root));const desk=new Desk();
 try{
  desk.execute({operations:[{kind:'add',object:{id:'note',type:'text',text:'first'}}]});
  const path=join(root,'日本語の机.tabletop');await service.save(path,dispatch(desk,{method:'file_snapshot'}) as any);
  const original=await readFile(path);
  desk.execute({operations:[{kind:'update',id:'note',patch:{text:'second'}}]});
  await assert.rejects(service.save(path,dispatch(desk,{method:'file_snapshot'}) as any),/同名/);assert.deepEqual(await readFile(path),original);
  await service.save(path,dispatch(desk,{method:'file_snapshot'}) as any,true);
  assert.equal((await service.load(path)).document.objects[0].text,'second');
  await assert.rejects(service.load('../escape.tabletop'));
  await assert.rejects(service.load(join(root,'missing.tabletop')));
  if(process.platform!=='win32'){await symlink(path,join(root,'link.tabletop'));await assert.rejects(service.save(join(root,'link.tabletop'),dispatch(desk,{method:'file_snapshot'}) as any,true),/symlink/);}
  assert.equal((await service.load('日本語の机.tabletop')).path,path);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('history keeps unique successful references, removes entries and tolerates unavailable storage',()=>{
 let value='[]';const storage={getItem:()=>value,setItem:(_k:string,v:string)=>{value=v;}};const history=new DeskFileHistory(storage);
 history.record('/a.tabletop','A');history.record('/b.tabletop','B');history.record('/a.tabletop','A renamed');
 assert.deepEqual(history.list().map(e=>e.path),['/a.tabletop','/b.tabletop']);
 assert.equal(new DeskFileHistory(storage).list()[0].name,'A renamed');history.remove('/a.tabletop');assert.equal(history.list().length,1);
 const unavailable=new DeskFileHistory({getItem:()=>{throw Error();},setItem:()=>{throw Error();}});unavailable.record('/a.tabletop','A');assert.equal(unavailable.list().length,1);
});
test('desk links round-trip as editable reference cards and stale save cannot attach a path to another document',async()=>{
 const desk=new Desk();desk.execute({operations:[{kind:'add',object:{id:'desk-link',type:'link',deskPath:'/tmp/別の机.tabletop',text:'別の机'}}]});
 const original=desk.documentGeneration;const revision=desk.revision;
 const bytes=await encodeDeskFile(desk);const decoded=await decodeDeskFile(bytes);assert.equal(decoded.objects[0].deskPath,'/tmp/別の机.tabletop');
 desk.replaceDocument({objects:decoded.objects,settings:decoded.settings});
 assert.notEqual(desk.documentGeneration,original);
 assert.deepEqual(dispatch(desk,{method:'file_saved',expectedSessionId:desk.sessionId,expectedRevision:revision,expectedGeneration:original,filePath:'/old.tabletop'}),{marked:false});assert.equal(desk.filePath,null);
 desk.filePath='/new.tabletop';desk.undo();assert.equal(desk.filePath,null);
});
