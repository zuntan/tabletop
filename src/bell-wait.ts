import {randomUUID} from 'node:crypto';
import {z} from 'zod';
export const bellWaitFields={afterSequence:z.number().int().nonnegative().default(0),epoch:z.string().max(100).optional(),timeoutMs:z.number().int().min(0).max(60000).default(1000)};
export const bellPressSchema=z.object({type:z.literal('bell_press'),ids:z.array(z.string().min(1).max(100)).max(200),text:z.string().max(10000).default(''),draftVersion:z.number().int().nonnegative().default(0)}).strict();
type Event={sequence:number;ids:string[];pressedAt:string;text:string;draftVersion:number};
type Result={status:'bell'|'timeout'|'disconnected'|'reset';epoch:string;sequence:number;ids:string[];pressedAt?:string;text?:string};
/** Bounded notification waiting; no revisions, polling loops or document state. */
export class BellWait {
 readonly epoch=randomUUID();
 private latest:Event={sequence:0,ids:[],pressedAt:'',text:'',draftVersion:0};
 private pending=false;
 private waiters=new Set<(status:Result['status'])=>void>();
 constructor(private changed:()=>void=()=>{},private collected:(note:{text:string;draftVersion:number})=>void=()=>{}){}
 state(){return {epoch:this.epoch,sequence:this.latest.sequence,pending:this.pending,waiting:this.waiters.size};}
 private result(status:Result['status']):Result{if(status==='bell')this.collected({text:this.latest.text,draftVersion:this.latest.draftVersion});return {status,epoch:this.epoch,sequence:this.latest.sequence,ids:[...this.latest.ids],...(status==='bell'?{text:this.latest.text}:{}),...(this.latest.pressedAt?{pressedAt:this.latest.pressedAt}:{})};}
 ring(ids:string[],text='',draftVersion=0){this.latest={sequence:this.latest.sequence+1,ids:[...new Set(ids)],pressedAt:new Date().toISOString(),text,draftVersion};this.pending=true;for(const done of [...this.waiters])done('bell');this.changed();}
 acknowledge(){if(this.pending){this.pending=false;this.changed();}}
 disconnect(){for(const done of [...this.waiters])done('disconnected');}
 wait(afterSequence:number,timeoutMs:number,epoch?:string,signal?:AbortSignal):Promise<Result>{
  if(signal?.aborted)return Promise.reject(new Error('Bell wait cancelled'));
  if(epoch&&epoch!==this.epoch||afterSequence>this.latest.sequence)return Promise.resolve(this.result('reset'));
  if(afterSequence<this.latest.sequence)return Promise.resolve(this.result('bell'));
  if(this.waiters.size>=8)return Promise.reject(new Error('At most eight bell waits'));
  return new Promise((resolve,reject)=>{
   let timer:ReturnType<typeof setTimeout>;
   const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);this.waiters.delete(done);this.changed();};
   const done=(status:Result['status'])=>{cleanup();resolve(this.result(status));};
   const abort=()=>{cleanup();reject(new Error('Bell wait cancelled'));};
   timer=setTimeout(()=>done('timeout'),timeoutMs);this.waiters.add(done);signal?.addEventListener('abort',abort,{once:true});this.changed();
  });
 }
}
