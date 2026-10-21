import { z } from 'zod';
import { colorSchema } from './settings';
import { isShapeType } from './shape-definitions';
import type { DeskObject, Operation } from './model';
import { stickerShapeIds, type StickerShape } from './sticker-shapes';
export type { StickerShape } from './sticker-shapes';
export const stickerShapeSchema = z.enum(stickerShapeIds);
const itemSchema = z.object({color:colorSchema,shape:stickerShapeSchema.default('circle')}).strict();
export const stickerSchema = z.object({
  items: z.array(itemSchema).optional(),
  colors: z.array(colorSchema).optional(),
  origin: z.enum(['top-left','top-right','bottom-left','bottom-right']).default('top-right'),
  diameter: z.number().finite().min(1).max(100000).default(36),
  fixed: z.boolean().default(false),
}).strict().refine(value=>!(value.items && value.colors), 'Use items or legacy colors, not both').transform(({colors,items,...settings})=>({...settings,items:items??(colors??[]).map(color=>({color,shape:'circle' as const}))}));
export type Stickers = z.infer<typeof stickerSchema>;
export const stickerTarget = (object: {type:string}) => object.type === 'text' || isShapeType(object.type) || ['image','svg','mermaid','web','link'].includes(object.type);
export function stickerOperations(objects: DeskObject[], action: {kind:'append';color:string;shape?:StickerShape} | {kind:'clear'} | {kind:'settings';patch:Partial<Omit<Stickers,'items'>>}): Operation[] {
  return objects.filter(stickerTarget).flatMap(object => {
    const current = stickerSchema.parse(object.stickers ?? {});
    if (action.kind === 'clear' && !current.items.length) return [];
    const stickers = stickerSchema.parse(action.kind === 'append' ? {...current,items:[...current.items,{color:action.color,shape:action.shape??'circle'}]} : action.kind === 'clear' ? {...current,items:[]} : {...current,...action.patch});
    return [{kind:'update' as const,id:object.id,patch:{stickers}}];
  });
}
/** One diameter of inset on both horizontal sides; at least one column. */
export function stickerLayout(width: number, stickers: Stickers, zoom = 1) {
  const diameter = stickers.diameter / (stickers.fixed ? zoom : 1), step = diameter * 1.2;
  const inset = Math.min(diameter, width / 2);
  const columns = Math.max(1, Math.floor((width - 2 * inset) / step + 1e-9) + 1);
  return { diameter, step, inset, columns, rows: Math.ceil(stickers.items.length / columns) };
}
export function stickerPoints(width:number, height:number, stickers:Stickers, zoom=1) {
  const {diameter,step,inset,columns}=stickerLayout(width,stickers,zoom);
  const right=stickers.origin.endsWith('right'),bottom=stickers.origin.startsWith('bottom');
  const verticalInset=Math.min(diameter,height/2);
  return stickers.items.map((item,index)=>({...item,diameter,
    x:(right?width-inset:inset)+(right?-1:1)*(index%columns)*step,
    y:(bottom?height-verticalInset:verticalInset)+(bottom?-1:1)*Math.floor(index/columns)*step}));
}
