import { z } from 'zod';
import type { DeskObject } from './model';
import { appearanceSchema, type Appearance } from './settings';
import { isShapeType } from './shape-definitions';

const styleSchema = appearanceSchema.partial().extend({
  cornerRadius: z.number().finite().min(0).max(100000).optional(),
  padding: z.number().finite().min(0).max(100000).optional(),
  textFit: z.enum(['fixed','auto','shrink']).optional(),
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
export function supportsFormat(type: string) { return type === 'text' || type === 'line' || isShapeType(type); }
export function formatKeys(type: string): (keyof FormatStyle)[] {
  if (type === 'line') return ['stroke','strokeWidth','dash','startMarker','endMarker','junctionRounding'];
  if (type !== 'text' && !isShapeType(type)) return [];
  return ['fill','fillOpacity','stroke','strokeWidth','textColor','fontSize',
    ...(type === 'text' ? ['cornerRadius','padding'] as const : ['textFit'] as const),
    ...(type === 'roundedRect' ? ['cornerRadius'] as const : [])];
}
export function extractFormat(object: DeskObject): FormatStyle {
  const defaults = { padding: 6, textFit: 'fixed', dash: 'solid', startMarker: 'none', endMarker: 'none', junctionRounding: 0 };
  return styleSchema.parse(Object.fromEntries(formatKeys(object.type).map(key => [key, object[key as keyof DeskObject] ?? defaults[key as keyof typeof defaults]])));
}
export function formatPatch(style: FormatStyle, type: string): Partial<DeskObject> {
  return Object.fromEntries(formatKeys(type).filter(key => style[key] !== undefined)
    .map(key => [key, key === 'textFit' && style[key] === 'fixed' ? undefined : style[key]])) as Partial<DeskObject>;
}
export function formatDefaults(style: FormatStyle): Partial<Appearance> {
  return Object.fromEntries(Object.keys(appearanceSchema.shape).filter(key => style[key as keyof FormatStyle] !== undefined)
    .map(key => [key, style[key as keyof FormatStyle]]));
}
