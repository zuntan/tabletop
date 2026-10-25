import {z} from 'zod';
import {decodeDeskFile,MAX_DESK_FILE_BYTES} from './desk-file';

const loadRequest=z.object({action:z.literal('load'),path:z.string().min(1).max(8192)}).strict();
/** Fetch a static desk with the same archive validators used by local upload. */
export async function pagesFileRequest(input:unknown,base:string){
 const {path}=loadRequest.parse(input),url=new URL(path,base);
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('机の参照先にはHTTP(S)のURLを指定してください');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30_000);
 try{
  const response=await fetch(url,{credentials:'omit',signal:controller.signal});
  if(!response.ok)throw new Error(`机を取得できませんでした（HTTP ${response.status}）`);
  if(Number(response.headers.get('content-length'))>MAX_DESK_FILE_BYTES)throw new Error('机ファイルは50MiB以下にしてください');
  const chunks:Uint8Array[]=[];let size=0;
  if(response.body){
   const reader=response.body.getReader();
   try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_DESK_FILE_BYTES){await reader.cancel();throw new Error('机ファイルは50MiB以下にしてください');}chunks.push(value);}}finally{reader.releaseLock();}
  }else{const bytes=new Uint8Array(await response.arrayBuffer());size=bytes.length;chunks.push(bytes);}
  if(size>MAX_DESK_FILE_BYTES)throw new Error('机ファイルは50MiB以下にしてください');
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const decoded=await decodeDeskFile(bytes);
  return{path:response.url||url.href,document:{objects:decoded.objects,settings:decoded.settings},missingAssets:decoded.warnings};
 }finally{clearTimeout(timer);controller.abort();}
}
