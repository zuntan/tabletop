import {clipboardTokenSchema,clipboardTransferSchema,type ClipboardRead} from './clipboard-transfer';
import {checkDeskBridgeSize} from './desk-file-protocol';
import {randomUUID} from 'node:crypto';
import {WebSocket,type RawData} from 'ws';
import {PairingGate} from './pairing-server';
import {helloSchema,pairingSchema,connectionDeskId,type Pairing} from './pairing-protocol';
import {BellWait,bellPressSchema} from './bell-wait';
import {DeskFileService} from './desk-file-service';
import {DeskShareServer} from './share-server';
import type {DeskRequest} from './desk-target';
import type {Request} from './model';

type Pending={resolve:(result:unknown)=>void;reject:(error:Error)=>void;timer:NodeJS.Timeout};
export class DeskConnection {
 peer:WebSocket|null=null;
 releasing=false;
 fileBusy=false;
 releaseCapable=false;bellCapable=false;toastCapable=false;
 readonly pending=new Map<string,Pending>();
 readonly gate=new PairingGate(()=>this.peer!==null||this.releasing);
 readonly files=new DeskFileService();
 bell=this.newBell();
 readonly sharing=new DeskShareServer(payload=>this.request(payload),()=>this.peer?.readyState===WebSocket.OPEN?this.peer:null);
 metadata:Record<string,unknown>={};
 constructor(private changing:()=>boolean,private handoff:(desk:DeskConnection)=>Promise<unknown>,private clipboard:(desk:DeskConnection,token:string)=>Promise<unknown>=async()=>null){}
 get deskId(){const pair=this.gate.info();return pair?connectionDeskId(pair.pairId):undefined;}
 get connected(){return this.peer?.readyState===WebSocket.OPEN;}
 private send(value:unknown){if(this.connected)this.peer!.send(JSON.stringify(value));}
 private newBell(){return new BellWait(()=>{if(this.bellCapable)this.send({type:'bell_state',...this.bell.state()});},note=>this.send({type:'bell_collected',...note}));}
 activity(){this.bell.acknowledge();if(this.bellCapable)this.send({type:'ai_activity'});}
 attach(ws:WebSocket){
  this.peer=ws;this.releaseCapable=false;this.bellCapable=false;this.toastCapable=false;this.bell.disconnect();this.bell=this.newBell();
  ws.on('message',data=>{
   try{
    if(this.peer!==ws)return;
    const message=JSON.parse(data.toString());
    if(message.type==='file_request'){
     const id=typeof message.id==='string'?message.id:'';
     if(!id||id.length>100)throw Error('Invalid file request');
     if(message.request?.method==='clipboard_lookup'){
      const token=clipboardTokenSchema.parse(message.request.token);
      void this.clipboard(this,token).then(result=>{if(this.peer===ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'file_result',id,result}));}).catch(()=>{if(this.peer===ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'file_result',id,result:null}));});return;
     }
     if(this.fileBusy||this.pending.size||this.releasing||this.changing()){ws.send(JSON.stringify({type:'file_result',id,error:'別の処理が進行中です。完了してから再実行してください'}));return;}
     this.fileBusy=true;
     void this.files.browser(message.request).then(result=>{if(this.peer===ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'file_result',id,result}));})
      .catch(error=>{if(this.peer===ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'file_result',id,error:error instanceof Error?error.message:String(error)}));})
      .finally(()=>{this.fileBusy=false;});return;
    }
    if(message.type==='handoff_request'){void this.handoff(this).catch(()=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'handoff_error',error:'引き渡しできませんでした。LANの許可・接続状態・処理中の操作を確認してください。'}));});return;}
    if(message.type==='bell_press'){const press=bellPressSchema.parse(message);this.bell.ring(press.ids,press.text,press.draftVersion);return;}
    if(message.type==='capabilities'&&message.release===true){this.releaseCapable=true;this.bellCapable=message.bell===true;this.toastCapable=message.toast===true;if(message.fileOperations===true)this.send({type:'file_ready'});if(this.bellCapable)this.send({type:'bell_state',...this.bell.state()});return;}
    const item=this.pending.get(message.id);if(!item)return;
    clearTimeout(item.timer);this.pending.delete(message.id);
    if(typeof message.error==='string')item.reject(Error(message.error));else item.resolve(message.result);
   }catch{ws.close(1007,'Invalid response');}
  });
  ws.on('error',error=>console.error('[Tabletop] WebSocket:',error.message));
  ws.on('close',()=>{if(this.peer!==ws)return;this.peer=null;this.sharing.revoke();this.bell.disconnect();this.rejectPending('Browser disconnected; operation outcome may be unknown. Inspect this desk before retrying.');});
 }
 bind():DeskRequest{
  const peer=this.peer;if(!peer||!this.connected)throw Error('Desk is disconnected. Inspect desk_connections; do not redirect to another desk.');
  this.activity();return payload=>this.request(payload,peer,false);
 }
 request(payload:Request|ClipboardRead,expectedPeer=this.peer,notify=true,timeoutMs=10_000):Promise<unknown>{
  return new Promise((resolve,reject)=>{
   if(!expectedPeer||this.peer!==expectedPeer||expectedPeer.readyState!==WebSocket.OPEN){reject(Error('Desk disconnected or connection changed; no request was sent.'));return;}
   if(this.fileBusy||this.releasing||this.changing()){reject(Error('Desk file/release or server network operation in progress; no request was sent.'));return;}
   if(notify&&payload.method!=='share_read')this.activity();
   const id=randomUUID(),timer=setTimeout(()=>{this.pending.delete(id);reject(Error('Browser response timed out; outcome may be unknown. Inspect this desk before retrying; no automatic replay.'));},timeoutMs);
   this.pending.set(id,{resolve,reject,timer});
   expectedPeer.send(JSON.stringify({id,request:payload}),error=>{if(error){clearTimeout(timer);this.pending.delete(id);reject(error);}});
  });
 }
 rejectPending(reason:string){for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error(reason));}this.pending.clear();}
 async describe():Promise<Record<string,unknown>&{deskId:string|undefined;connected:boolean}>{
  if(this.connected){
   try{const peer=this.peer;const request:DeskRequest=payload=>this.request(payload,peer,false);const [summary,settings]=await Promise.all([request({method:'summary'}),request({method:'settings'})]) as [Record<string,unknown>,Record<string,unknown>];
    this.metadata={name:summary.name??'',sessionId:summary.sessionId,revision:summary.revision,background:settings.background};
   }catch{/* A disconnect/error does not make the remaining desks inaccessible. */}
  }
  return {...this.metadata,deskId:this.deskId,connected:this.connected};
 }
}

/** Registry of paired endpoints. There is deliberately no current desk. */
export class DeskConnections {
 readonly entries=new Set<DeskConnection>();
 private accepting:DeskConnection|null=null;
 private routing=new Set<WebSocket>();
 private epoch=0;private reserved=false;private revoked=new Set<string>();
 constructor(private changing:()=>boolean,private handoff:(desk:DeskConnection)=>Promise<unknown>,private admitted:()=>void=()=>{}){}
 get canBootstrap(){return !this.reserved&&!!this.accepting?.gate.canBootstrap;}
 get pendingCount(){return this.routing.size+[...this.entries,this.accepting].reduce((n,d)=>n+(d?.gate.pendingCount??0),0);}
 get acceptanceEpoch(){return this.epoch;}
 get admissionReserved(){return this.reserved;}
 get connectedCount(){return [...this.entries].filter(d=>d.connected).length;}
 reserveAdmission(){if(this.reserved)throw Error('Another handoff is pending');this.reserved=true;this.accepting?.gate.suspend();this.accepting=null;return this.epoch+1;}
 finishAdmission(open:boolean){this.reserved=false;return open?this.open():undefined;}
 open(){
  if(this.reserved)throw Error('A handoff is pending; wait before opening another pairing');
  if(!this.canBootstrap){this.epoch++;this.accepting=new DeskConnection(this.changing,this.handoff,(desk,token)=>this.lookupClipboard(desk,token));this.accepting.gate.open();}
  return {waitingFor:'new-pairing',bootstrapReady:true,browserConnected:this.connectedCount>0};
 }
 get(deskId:string){const desk=[...this.entries].find(d=>d.deskId===deskId);if(!desk)throw Error('Unknown deskId. Read desk_connections; no other desk was selected.');return desk;}
 bind(deskId:string){return this.get(deskId).bind();}
 info(deskId:string){return this.get(deskId).gate.info();}
 restore(input:unknown){
  const pair=pairingSchema.parse(input),id=connectionDeskId(pair.pairId);
  let desk=[...this.entries].find(d=>d.gate.info()?.pairId===pair.pairId);
  if(!desk){if([...this.entries].some(d=>d.deskId===id))throw Error('Desk ID collision; pairing was not restored');desk=new DeskConnection(this.changing,this.handoff,(desk,token)=>this.lookupClipboard(desk,token));desk.gate.restore(pair);this.entries.add(desk);}
  else desk.gate.restore(pair);
  this.revoked.delete(pair.pairId);return {waitingFor:'paired-desk',deskId:id};
 }
 accept(ws:WebSocket,initial:boolean){
  const attach=(desk:DeskConnection)=>{
   const id=desk.deskId;
   if([...this.entries].some(other=>other!==desk&&other.deskId===id)){desk.gate.suspend();ws.close(4003,'Desk ID collision');return;}
   this.entries.add(desk);if(this.accepting===desk){this.accepting=null;this.admitted();}desk.attach(ws);
  };
  if(initial){const desk=this.accepting;if(!desk||!desk.gate.canBootstrap){ws.close(4003,'Manual pairing required');return;}desk.gate.accept(ws,true,()=>attach(desk));return;}
  // The hello only selects a pairing; authentication still requires its proof.
  ws.on('error',()=>{});
  this.routing.add(ws);const timer=setTimeout(()=>ws.terminate(),8000);
  const clean=()=>{clearTimeout(timer);this.routing.delete(ws);};ws.once('close',clean);
  ws.once('message',(data:RawData)=>{clean();try{
   if((Array.isArray(data)?data.reduce((n,p)=>n+p.byteLength,0):data.byteLength)>4096)throw Error('Invalid hello');
   const hello=helloSchema.parse(JSON.parse(data.toString()));
   const desk=[...this.entries].find(d=>d.gate.info()?.pairId===hello.pairId);
   if(!desk){ws.close(this.revoked.has(hello.pairId??'')?4003:4000,'Pairing unavailable; recover or reconnect explicitly');return;}
   desk.gate.accept(ws,false,()=>attach(desk),data);
  }catch{ws.close(4003,'Invalid pairing hello');}});
 }
 remove(desk:DeskConnection){const pair=desk.gate.info();if(pair)this.revoked.add(pair.pairId);desk.gate.suspend();this.entries.delete(desk);void desk.sharing.close().catch(()=>{/* In-flight open sees the revoked epoch and closes itself. */});}
 async lookupClipboard(requester:DeskConnection,token:string){
  clipboardTokenSchema.parse(token);
  if(!requester.connected||requester.fileBusy||requester.releasing||this.changing())return null;
  const answers=await Promise.all([...this.entries].filter(d=>d!==requester&&d.connected&&!d.fileBusy&&!d.releasing&&!d.pending.size).map(async desk=>{
   try{
    const raw=await desk.request({method:'clipboard_read',token},desk.peer,false,800);
    if(raw===null)return null;checkDeskBridgeSize(raw);
    const data=clipboardTransferSchema.parse(raw);return data.token===token?data:null;
   }catch{return null;}
  }));
  const found=answers.filter(answer=>answer!==null);
  return found.length===1?found[0]:null;
 }
 async list(){return Promise.all([...this.entries].map(d=>d.describe()));}
 close(){this.accepting?.gate.suspend();for(const ws of this.routing)ws.close(1001,'Server closing');for(const desk of this.entries){desk.gate.suspend();desk.sharing.revoke();desk.bell.disconnect();desk.rejectPending('Server closing');desk.peer?.close(1001,'Server closing');}}
}
