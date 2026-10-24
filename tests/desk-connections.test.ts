import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {WebSocket} from 'ws';
import {DeskConnection,DeskConnections} from '../src/desk-connections';
import type {Pairing} from '../src/pairing-protocol';

class Peer extends EventEmitter {
 readyState:number=WebSocket.OPEN;
 sent:{id?:string;request?:unknown}[]=[];
 send(text:string,callback?:(error?:Error)=>void){this.sent.push(JSON.parse(text));callback?.();}
 close(){this.readyState=WebSocket.CLOSED;this.emit('close');}
 socket(){return this as unknown as WebSocket;}
 reply(result:unknown){const id=[...this.sent].reverse().find(m=>m.id)?.id;assert.ok(id);this.emit('message',Buffer.from(JSON.stringify({id,result})));}
}
const pairing=():Pairing=>({pairId:crypto.randomUUID(),token:'a'.repeat(64),secret:'b'.repeat(64)});
const connection=()=>new DeskConnection(()=>false,async()=>{});

test('a bound multi-step request cannot continue on a reconnected socket or affect another desk',async()=>{
 const a=connection(),b=connection(),old=new Peer(),other=new Peer(),replacement=new Peer();
 a.attach(old.socket());b.attach(other.socket());
 try{
  const bound=a.bind(),pending=bound({method:'summary'}),unaffected=b.bind()({method:'summary'});
  const rejected=assert.rejects(pending,/disconnected/);old.close();await rejected;
  a.attach(replacement.socket());
  await assert.rejects(bound({method:'settings'}),/connection changed/);assert.equal(replacement.sent.length,0);
  const fresh=a.bind()({method:'summary'});old.emit('close');
  replacement.reply({name:'new socket'});other.reply({name:'other desk'});
  assert.deepEqual(await fresh,{name:'new socket'});assert.deepEqual(await unaffected,{name:'other desk'});
 }finally{replacement.close();other.close();}
});

test('restoring a disconnected endpoint leaves another connected pairing and pending request intact',async()=>{
 const registry=new DeskConnections(()=>false,async()=>{}),a=connection(),peer=new Peer();
 const first=pairing(),second=pairing();a.gate.restore(first);registry.entries.add(a);a.attach(peer.socket());
 try{
  const pending=registry.bind(a.deskId!)({method:'summary'});
  const restored=registry.restore(second);assert.notEqual(restored.deskId,a.deskId);assert.equal(registry.connectedCount,1);
  assert.deepEqual(registry.info(a.deskId!),first);assert.deepEqual(registry.info(restored.deskId),second);
  assert.throws(()=>registry.bind(restored.deskId),/disconnected/);
  peer.reply({name:'still here'});assert.deepEqual(await pending,{name:'still here'});
  registry.open();assert.equal(a.connected,true);assert.deepEqual(registry.info(a.deskId!),first);
 }finally{registry.close();}
});

test('clipboard lookup only accepts the exact marker and rejects conflicting answers without caching',async()=>{
 const registry=new DeskConnections(()=>false,async()=>{}),target=connection(),source=connection(),unrelated=connection();
 const peers=[new Peer(),new Peer(),new Peer()];
 [target,source,unrelated].forEach((desk,i)=>{desk.gate.restore(pairing());desk.attach(peers[i].socket());registry.entries.add(desk);});
 const token=crypto.randomUUID();
 try{
  const {objectSchema}=await import('../src/model');const payload={token,objects:[objectSchema.parse({id:'a',type:'text',text:'copied'})],series:[]};
  let lookup=registry.lookupClipboard(target,token);assert.equal(peers[0].sent.length,0);peers[1].reply(payload);peers[2].reply(null);assert.deepEqual(await lookup,payload);
  lookup=registry.lookupClipboard(target,token);peers[1].reply({...payload,token:crypto.randomUUID()});peers[2].reply(null);assert.equal(await lookup,null);
  lookup=registry.lookupClipboard(target,token);peers[1].reply(payload);peers[2].reply(payload);assert.equal(await lookup,null);
  const started=Date.now();assert.equal(await registry.lookupClipboard(target,token),null);assert.ok(Date.now()-started<1500);assert.equal(source.pending.size,0);
  peers[1].close();peers[2].close();assert.equal(await registry.lookupClipboard(target,token),null);
 }finally{registry.close();}
});
