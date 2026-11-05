import { DeskError } from './desk-errors';
import {MAX_ASSET_BYTES,MAX_MANIFEST_BYTES,MAX_DESK_BYTES} from './data-limits';

const encoder=new TextEncoder(),decoder=new TextDecoder();
export function dataBytes(value:string){const text=value.slice(value.indexOf(',')+1).replace(/\s/g,'');const decoded=atob(text);return Uint8Array.from(decoded,c=>c.charCodeAt(0));}
export function bytesDataUrl(bytes:Uint8Array,mime='application/octet-stream'){
 let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return `data:${mime};base64,${btoa(text)}`;
}
/** A metadata JSON plus length-delimited raw attachments. No base64 on the wire. */
export function packEnvelope(value:unknown):Uint8Array{
 const attachments:Uint8Array[]=[],references:{path:(string|number)[];index:number;prefix:string}[]=[],seen=new Map<string,number>();let total=0;
 function walk(v:any,path:(string|number)[]=[]):any{
  const binary=typeof v==='string'&&/^data:[\w.+/-]+;base64,/.test(v);
  const pdf=typeof v==='string'&&path.at(-1)==='base64';
  if(binary||pdf){
   const prefix=binary?v.slice(0,v.indexOf(',')+1):'';let index=seen.get(v);
   if(index===undefined){const bytes=dataBytes(binary?v:`data:application/octet-stream;base64,${v}`);if(prefix.startsWith('data:image/'))checkImage(bytes.length);total+=bytes.length;if(total>MAX_DESK_BYTES)throw Error('Binary payload exceeds 250MB');index=attachments.length;attachments.push(bytes);seen.set(v,index);}
   references.push({path,index,prefix});return null;
  }
  if(Array.isArray(v))return v.map((item,i)=>walk(item,[...path,i]));
  if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,item])=>[k,walk(item,[...path,k])]));
  return v;
 }
 const document=walk(value),header=encoder.encode(JSON.stringify({document,references,lengths:attachments.map(a=>a.length)}));
 if(header.length>MAX_MANIFEST_BYTES)throw Error('Transfer metadata exceeds 10MB');
 const out=new Uint8Array(4+header.length+total);new DataView(out.buffer).setUint32(0,header.length);out.set(header,4);let offset=4+header.length;for(const a of attachments){out.set(a,offset);offset+=a.length;}return out;
}
function checkImage(size:number){if(size>MAX_ASSET_BYTES)throw new DeskError('assetSize');}
export function unpackEnvelope(bytes:Uint8Array):any{
 if(bytes.length<4)throw Error('Invalid binary envelope');const length=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(0);
 if(length>MAX_MANIFEST_BYTES||length>bytes.length-4)throw Error('Invalid metadata size');
 const {document,references,lengths}=JSON.parse(decoder.decode(bytes.subarray(4,4+length)));
 if(!Array.isArray(lengths)||!Array.isArray(references)||references.length>100_000)throw Error('Invalid attachments');
 const attachments:Uint8Array[]=[];let offset=4+length;
 for(const n of lengths){if(!Number.isSafeInteger(n)||n<0||offset+n>bytes.length)throw Error('Invalid attachment size');attachments.push(bytes.subarray(offset,offset+n));offset+=n;}
 if(offset!==bytes.length||offset-4-length>MAX_DESK_BYTES)throw Error('Invalid envelope length');
 const strings=new Map<string,string>();
 for(const r of references){if(!Array.isArray(r.path)||!r.path.length||typeof r.prefix!=='string'||!Number.isSafeInteger(r.index)||!attachments[r.index])throw Error('Invalid reference');
  let node=document;for(const key of r.path.slice(0,-1)){if(!node||!Object.hasOwn(node,key))throw Error('Invalid reference path');node=node[key];}
  const key=r.path.at(-1);if(!node||!Object.hasOwn(node,key)||node[key]!==null)throw Error('Invalid reference target');
  if(!/^(?:data:[\w.+/-]+;base64,)?$/.test(r.prefix))throw Error('Invalid binary prefix');
  if(r.prefix.startsWith('data:image/'))checkImage(attachments[r.index].length);
  const cacheKey=`${r.index}:${r.prefix}`;let text=strings.get(cacheKey);if(text===undefined){text=bytesDataUrl(attachments[r.index]).split(',')[1];text=r.prefix+text;strings.set(cacheKey,text);}node[key]=text;
 }
 return document;
}
