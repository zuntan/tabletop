import {MAX_WS_BYTES,MAX_DESK_BYTES,MAX_MANIFEST_BYTES,TRANSFER_CHUNK_BYTES,TRANSFER_IDLE_MS} from './data-limits';
import {randomUuid,sha256Hex} from './portable-crypto';
import {packEnvelope,unpackEnvelope} from './binary-envelope';
export interface TransferSink{write(bytes:Uint8Array):Promise<void>;finish():Promise<Uint8Array>;dispose():Promise<void>}
export const memorySink=async():Promise<TransferSink>=>{const parts:Uint8Array[]=[];return{async write(b){parts.push(b.slice());},async finish(){const size=parts.reduce((n,b)=>n+b.length,0),out=new Uint8Array(size);let offset=0;for(const p of parts){out.set(p,offset);offset+=p.length;}parts.length=0;return out;},async dispose(){parts.length=0;}};};
const MAX_TRANSFER_BYTES=MAX_DESK_BYTES+MAX_MANIFEST_BYTES+4;
const uuid=/^[a-f0-9-]{36}$/;
/** Stop-and-wait, SHA-256 checked, per-connection binary transport. */
export class BinaryTransfer{
 private outgoing?:{id:string;ack?:{sequence:number;resolve:()=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}};
 private incoming?:{id:string;size:number;hash:string;sequence:number;received:number;sink:TransferSink;timer?:ReturnType<typeof setTimeout>};
 private closed=false;
 constructor(private wire:(data:string|Uint8Array)=>void,private deliver:(value:any)=>void,private sink=memorySink,private progress:(done:number,total:number)=>void=()=>{},private idleMs=TRANSFER_IDLE_MS){}
 async send(value:unknown){
  if(this.closed)throw Error('Connection closed');
  // Small control messages do not occupy the bulk-transfer slot.
  const binary=(v:any):boolean=>typeof v==='string'?/^data:[\w.+/-]+;base64,/.test(v):!!v&&typeof v==='object'&&Object.entries(v).some(([key,item])=>key==='base64'&&typeof item==='string'||binary(item));
  if(!binary(value)){const text=JSON.stringify(value);if(text.length<=TRANSFER_CHUNK_BYTES&&new TextEncoder().encode(text).length<=TRANSFER_CHUNK_BYTES){this.wire(text);return;}}
  if(this.outgoing)throw Error('Another binary transfer is in progress');
  const state={id:randomUuid()} as NonNullable<BinaryTransfer['outgoing']>;this.outgoing=state;
  try{
   const bytes=packEnvelope(value),hash=sha256Hex(bytes);
   await this.exchange(state,-1,JSON.stringify({type:'binary_begin',id:state.id,size:bytes.length,hash,purpose:(value as any)?.request?.method??(value as any)?.request?.action??(value as any)?.type??'result'}));
   for(let offset=0,sequence=0;offset<bytes.length;offset+=TRANSFER_CHUNK_BYTES,sequence++){
    const chunk=bytes.subarray(offset,offset+TRANSFER_CHUNK_BYTES),frame=new Uint8Array(40+chunk.length);frame.set(new TextEncoder().encode(state.id));new DataView(frame.buffer).setUint32(36,sequence);frame.set(chunk,40);
    await this.exchange(state,sequence,frame);this.progress(offset+chunk.length,bytes.length);
   }
   await this.exchange(state,-2,JSON.stringify({type:'binary_end',id:state.id}));
  }catch(error){this.control({type:'binary_cancel',id:state.id,error:error instanceof Error?error.message:String(error)});throw error;}
  finally{if(state.ack){clearTimeout(state.ack.timer);state.ack=undefined;}if(this.outgoing===state)this.outgoing=undefined;}
 }
 private exchange(state:NonNullable<BinaryTransfer['outgoing']>,sequence:number,data:string|Uint8Array){if(this.closed)return Promise.reject(Error('Connection closed during transfer'));return new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{state.ack=undefined;reject(Error('Binary transfer made no progress for 30 seconds'));},this.idleMs);state.ack={sequence,resolve,reject,timer};try{this.wire(data);}catch(e){clearTimeout(timer);state.ack=undefined;reject(e);}});}
 private control(value:unknown){if(!this.closed)try{this.wire(JSON.stringify(value));}catch{}}
 private touch(){const state=this.incoming;if(!state)return;clearTimeout(state.timer);state.timer=setTimeout(()=>{void this.abortIncoming('Binary transfer made no progress for 30 seconds');},this.idleMs);}
 private async abortIncoming(message:string){const state=this.incoming;if(!state)return;this.incoming=undefined;clearTimeout(state.timer);await state.sink.dispose();this.control({type:'binary_cancel',id:state.id,error:message});}
 async receive(data:string|Uint8Array){
  if(this.closed)return;
  try{
   if(typeof data!=='string'){
    const s=this.incoming;if(!s||data.length<41||data.length>TRANSFER_CHUNK_BYTES+40)throw Error('Unexpected binary chunk');
    const id=new TextDecoder().decode(data.subarray(0,36)),sequence=new DataView(data.buffer,data.byteOffset,data.byteLength).getUint32(36);
    if(id!==s.id||sequence!==s.sequence||s.received+data.length-40>s.size||data.length-40!==Math.min(TRANSFER_CHUNK_BYTES,s.size-s.received))throw Error('Invalid chunk order or size');
    clearTimeout(s.timer);await s.sink.write(data.subarray(40));s.received+=data.length-40;s.sequence++;this.touch();this.progress(s.received,s.size);this.control({type:'binary_ack',id:s.id,sequence});return;
   }
   if(new TextEncoder().encode(data).length>MAX_WS_BYTES)throw Error('Message exceeds 20MB');
   const value=JSON.parse(data);
   if(value.type==='binary_verifying'){const s=this.outgoing;if(s&&s.id===value.id&&s.ack?.sequence===-2)clearTimeout(s.ack.timer);return;}
   if(value.type==='binary_ack'){const s=this.outgoing,a=s?.ack;if(s&&a&&s.id===value.id&&a.sequence===value.sequence){clearTimeout(a.timer);s.ack=undefined;a.resolve();}return;}
   if(value.type==='binary_cancel'){
    const s=this.outgoing;if(s&&s.id===value.id&&s.ack){clearTimeout(s.ack.timer);s.ack.reject(Error(String(value.error??'Transfer cancelled')));s.ack=undefined;}
    if(this.incoming?.id===value.id)await this.abortIncoming('Transfer cancelled');return;
   }
   if(value.type==='binary_begin'){
    if(this.incoming||!uuid.test(value.id)||!Number.isSafeInteger(value.size)||value.size<4||value.size>MAX_TRANSFER_BYTES||!/^[a-f0-9]{64}$/.test(value.hash)){this.control({type:'binary_cancel',id:value.id,error:'Invalid or overlapping transfer'});return;}
    const sink=await this.sink();if(this.closed){await sink.dispose();return;}
    this.incoming={id:value.id,size:value.size,hash:value.hash,sequence:0,received:0,sink};this.touch();this.control({type:'binary_ack',id:value.id,sequence:-1});return;
   }
   if(value.type==='binary_end'){
    const s=this.incoming;if(!s||s.id!==value.id||s.received!==s.size)throw Error('Incomplete transfer');clearTimeout(s.timer);this.control({type:'binary_verifying',id:s.id});
    const bytes=await s.sink.finish();if(bytes.length!==s.size||sha256Hex(bytes)!==s.hash)throw Error('Binary transfer checksum mismatch');const decoded=unpackEnvelope(bytes);await s.sink.dispose();this.incoming=undefined;this.control({type:'binary_ack',id:s.id,sequence:-2});this.deliver(decoded);return;
   }
   this.deliver(value);
  }catch(error){await this.abortIncoming(error instanceof Error?error.message:String(error));}
 }
 close(){this.closed=true;const s=this.outgoing;if(s?.ack){clearTimeout(s.ack.timer);s.ack.reject(Error('Connection closed during transfer'));s.ack=undefined;}void this.abortIncoming('Connection closed');}
}
