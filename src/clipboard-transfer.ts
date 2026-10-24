import {z} from 'zod';
import {objectSchema} from './model';
import {seriesSchema} from './settings';

export const clipboardTokenSchema=z.string().uuid();
export const clipboardTransferSchema=z.object({
 token:clipboardTokenSchema,
 objects:z.array(objectSchema).min(1).max(200),
 series:z.array(seriesSchema).max(200),
}).strict();
export type ClipboardTransfer=z.infer<typeof clipboardTransferSchema>;
export type ClipboardRead={method:'clipboard_read';token:string};
/** Only structured clipboard markers identify parts; plain text never does. */
export function partClipboardToken(token:string,html:string):string|undefined{
 if(clipboardTokenSchema.safeParse(token).success)return token;
 const marker=/data-tabletop-copy=["']([a-f0-9-]{36})["']/.exec(html)?.[1];
 return clipboardTokenSchema.safeParse(marker).success?marker:undefined;
}
