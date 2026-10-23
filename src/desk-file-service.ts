import { z } from 'zod';
import { Desk } from './model';
import { DeskFileStore } from './desk-file-store';
import { decodeDeskFile, encodeDeskFile } from './desk-file';
import { checkDeskBridgeSize } from './desk-file-protocol';
export const fileSnapshotSchema=z.object({sessionId:z.string().uuid(),revision:z.number().int().nonnegative(),generation:z.string().uuid().optional(),objects:z.array(z.unknown()),settings:z.unknown()}).strict();
const reference=z.string().min(1).max(4096);
const browserFileSchema=z.discriminatedUnion('action',[
  z.object({action:z.literal('save'),path:reference,overwrite:z.boolean(),snapshot:fileSnapshotSchema}).strict(),
  z.object({action:z.literal('load'),path:reference}).strict(),
]);
/** Shared disk operations; the caller owns replacement guards and human confirmation. */
export class DeskFileService{
  constructor(readonly store=new DeskFileStore()){}
  async save(path:string,snapshot:z.infer<typeof fileSnapshotSchema>,overwrite=false){
    const parsed=fileSnapshotSchema.parse(snapshot);checkDeskBridgeSize(parsed);
    const validator=new Desk();validator.replaceDocument({objects:parsed.objects,settings:parsed.settings});
    const bytes=await encodeDeskFile(validator);
    const resolved=await this.store.writeReference(path,bytes,overwrite);
    return {path:resolved,sessionId:parsed.sessionId,revision:parsed.revision,count:parsed.objects.length,formatVersion:1,bytes:bytes.length,name:validator.settingsSnapshot().name};
  }
  async load(path:string){
    const resolved=await this.store.reference(path);
    const decoded=await decodeDeskFile(await this.store.readReference(resolved));
    const result={path:resolved,document:{objects:decoded.objects,settings:decoded.settings},missingAssets:decoded.warnings};
    checkDeskBridgeSize(result);return result;
  }
  async browser(input:unknown){
    checkDeskBridgeSize(input);const request=browserFileSchema.parse(input);
    return request.action==='save'?this.save(request.path,request.snapshot,request.overwrite):this.load(request.path);
  }
}
