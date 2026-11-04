import {partialInputSchema} from './partial-input-schema';
import { z } from 'zod';
import {defaultReactionSize} from './reaction-values';
import {reactionPlacements,defaultReactionPlacement} from './reaction-layout';
import type { DeskObject } from './model';
import { appearanceSchema, type Appearance } from './settings';
import { isShapeType } from './shape-definitions';
import { stickerSchema, stickerTarget } from './sticker-values';

const styleSchema = partialInputSchema(appearanceSchema).extend({
  reactionSize:z.number().finite().min(1).max(100000).optional(),
  reactionPlacement:z.enum(reactionPlacements).optional(),
  reactionFixed:z.boolean().optional(),
  stickers: stickerSchema.nullable().optional(),
  cornerRadius: z.number().finite().min(0).max(100000).optional(),
  padding: z.number().finite().min(0).max(100000).optional(),
  textFit: z.enum(['fixed','auto','shrink']).optional(),
  fixedWidth:z.boolean().optional(),
  dash: z.enum(['solid','dashed','dotted']).optional(),
  startMarker: z.enum(['none','arrow','circle','diamond']).optional(),
  endMarker: z.enum(['none','arrow','circle','diamond']).optional(),
  junctionRounding: z.number().finite().min(0).max(100000).optional(),
}).strict();
export type FormatStyle = z.infer<typeof styleSchema>;
export const formatStorageKey = 'tabletop.format-styles.v1';
const savedSchema = z.object({ current: styleSchema, slots: z.tuple([styleSchema.nullable(),styleSchema.nullable(),styleSchema.nullable()]) }).strict();
export type FormatMemory = z.infer<typeof savedSchema>;
export function readFormatMemory(value: string | null): FormatMemory {
  try { return savedSchema.parse(JSON.parse(value ?? 'null')); } catch { return { current: {}, slots: [null,null,null] }; }
}
export function supportsFormat(type: string) { return type !== 'clip'; }
export function formatKeys(type: string): (keyof FormatStyle)[] {
  if(type==='clip')return [];
  return [...paintFormatKeys(type),'reactionSize','reactionPlacement','reactionFixed'];
}
function paintFormatKeys(type:string):(keyof FormatStyle)[]{
  if(type==='link')return ['stickers','fill','fillOpacity','stroke','strokeWidth','fontSize','textColor','cornerRadius'];
  if (type === 'line') return ['stroke','strokeWidth','fixedWidth','dash','startMarker','endMarker','junctionRounding'];
  if (type !== 'text' && !isShapeType(type)) return stickerTarget({type}) ? ['stickers'] : [];
  return ['stickers','fill','fillOpacity','stroke','strokeWidth','textColor','fontSize',
    ...(type === 'text' ? ['cornerRadius','padding'] as const : ['textFit'] as const),
    ...(type === 'roundedRect' ? ['cornerRadius'] as const : [])];
}
export function extractFormat(object: DeskObject): FormatStyle {
  const defaults = { reactionSize:defaultReactionSize, reactionPlacement:defaultReactionPlacement, reactionFixed:false, fixedWidth:false, stickers: null, padding: 6, textFit: 'fixed', dash: 'solid', startMarker: 'none', endMarker: 'none', junctionRounding: 0 };
  return styleSchema.parse(Object.fromEntries(formatKeys(object.type).map(key => [key, object[key as keyof DeskObject] ?? defaults[key as keyof typeof defaults]])));
}
export function formatPatch(style: FormatStyle, type: string): Partial<DeskObject> {
  return Object.fromEntries(formatKeys(type).filter(key => style[key] !== undefined)
    .map(key => [key, key === 'textFit' && style[key] === 'fixed' ? undefined : structuredClone(style[key])])) as Partial<DeskObject>;
}
export function formatDefaults(style: FormatStyle): Partial<Appearance> {
  return Object.fromEntries(Object.keys(appearanceSchema.shape).filter(key => style[key as keyof FormatStyle] !== undefined)
    .map(key => [key, style[key as keyof FormatStyle]]));
}
