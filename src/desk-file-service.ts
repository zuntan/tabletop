import {bytesDataUrl,dataBytes} from './binary-envelope';
import { z } from 'zod';
import { Desk } from './model';
import { DeskFileStore } from './desk-file-store';
import { decodeDeskFile, encodeDeskFile } from './desk-file';
export const fileSnapshotSchema=z.object({sessionId:z.string().uuid(),revision:z.number().int().nonnegative(),generation:z.string().uuid().optional(),objects:z.array(z.unknown()).optional(),settings:z.unknown().optional(),archiveDataUrl:z.string().optional(),count:z.number().int().optional(),name:z.string().optional()}).strict();
const reference=z.string().min(1).max(4096);
const browserFileSchema=z.discriminatedUnion('action',[
  z.object({action:z.literal('save'),path:reference,overwrite:z.boolean(),snapshot:fileSnapshotSchema}).strict(),
  z.object({action:z.literal('load'),path:reference}).strict(),
]);
/** Shared disk operations; the caller owns replacement guards and human confirmation. */
export class DeskFileService{
  constructor(readonly store=new DeskFileStore()){}
  async save(path:string,snapshot:z.infer<typeof fileSnapshotSchema>,overwrite=false){
    const parsed=fileSnapshotSchema.parse(snapshot);
    let bytes:Uint8Array,count:number,name:string|undefined;
    if(parsed.archiveDataUrl){bytes=dataBytes(parsed.archiveDataUrl);const decoded=await decodeDeskFile(bytes);count=decoded.objects.length;name=decoded.settings.name;}
    else{const validator=new Desk();validator.replaceDocument({objects:parsed.objects,settings:parsed.settings});bytes=await encodeDeskFile(validator);count=validator.snapshot().length;name=validator.settingsSnapshot().name;}
    const resolved=await this.store.writeReference(path,bytes,overwrite);
    return {path:resolved,sessionId:parsed.sessionId,revision:parsed.revision,count,formatVersion:1,bytes:bytes.length,name};
  }
  async load(path:string){
    const resolved=await this.store.reference(path);
    const bytes=await this.store.readReference(resolved);
    return {path:resolved,archiveDataUrl:bytesDataUrl(bytes),missingAssets:[] as string[]};
  }
  async browser(input:unknown){
    const request=browserFileSchema.parse(input);
    return request.action==='save'?this.save(request.path,request.snapshot,request.overwrite):this.load(request.path);
  }
}
