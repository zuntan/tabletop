import { z } from 'zod';
import type { DeskObject } from './model';
import { tightFrame } from './pin-shape';
import { gridSettingsSchema } from './grid-settings';
import { deskNameSchema } from './desk-identity';

export const colorSchema = z.string().regex(/^(#[0-9a-fA-F]{3,8}|transparent|[a-zA-Z]{1,20})$/);
export const backgroundSchema = z.object({
  wallpaper: z.enum(['none', 'wood-1', 'wood-2', 'wood', 'cutting-mat', 'pink-notebook', 'charcoal']).default('none'),
  color: colorSchema.nullable().default(null),
  titleBackground:z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  opacity: z.number().finite().min(0).max(1).default(1),
  underlayBrightness: z.number().finite().min(0).max(1).default(0.5),
  showGrid: z.boolean().nullable().default(null),
  selectionColor: colorSchema.nullable().default(null),
  pointingColor: colorSchema.nullable().default(null),
}).strict();
export const appearanceSchema = z.object({
  fill: colorSchema.default('#dbeafe'),
  fillOpacity: z.number().finite().min(0).max(1).default(0.3),
  stroke: colorSchema.default('#334155'),
  textColor: colorSchema.default('#0f172a'),
  strokeWidth: z.number().finite().min(0).max(100).default(2),
  fontSize: z.number().finite().min(1).max(1000).default(24),
}).strict();
export const formatSchema = z.enum(['decimal', 'lower-alpha', 'upper-alpha', 'lower-roman', 'upper-roman', 'circled', 'katakana']);
export const pinVisibilitySchema = z.enum(['all', 'pins', 'hidden']);
export const pinThreadSchema = z.object({
  enabled: z.boolean().default(true), visible: z.boolean().default(false),
  color: colorSchema.default('#64748b'), width: z.number().finite().min(0).max(100).default(2),
  opacity: z.number().finite().min(0).max(1).default(1),
  dash: z.enum(['solid', 'dashed', 'dotted']).default('solid'),
}).strict();
export const seriesSchema = appearanceSchema.extend({
  visibility: pinVisibilitySchema.default('all'),
  thread: z.preprocess(value => {
    // Early wallpaper builds accidentally wrote this background-only key into threads.
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const { underlayBrightness: _unused, ...thread } = value as Record<string, unknown>;
      return thread;
    }
    return value;
  }, pinThreadSchema).default({}),
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(100),
  format: formatSchema.default('decimal'),
  shape: z.enum(['text', 'rect', 'ellipse', 'roundedRect', 'pin']).default('pin'),
  width: z.number().finite().min(1).max(100_000).default(36),
  height: z.number().finite().min(1).max(100_000).default(48),
  cornerRadius: z.number().finite().min(0).max(100_000).default(12),
}).strict();
export const seriesPatchSchema = seriesSchema.omit({ id: true }).partial().extend({ thread: pinThreadSchema.partial().optional() }).strict();
export const settingsOperations = [
  z.object({ kind: z.literal('desk_rename'), name: deskNameSchema }).strict(),
  z.object({ kind: z.literal('grid_update'), patch: gridSettingsSchema.partial() }).strict(),
  z.object({ kind: z.literal('background_update'), patch: backgroundSchema.partial() }).strict(),
  z.object({ kind: z.literal('defaults_update'), patch: appearanceSchema.partial() }).strict(),
  z.object({ kind: z.literal('series_add'), series: seriesSchema.partial().required({ id: true, name: true }) }).strict(),
  z.object({ kind: z.literal('series_update'), id: z.string(), patch: seriesPatchSchema }).strict(),
  z.object({ kind: z.literal('label_add'), id: z.string().min(1).max(100), seriesId: z.string(),
    x: z.number().finite().min(-1_000_000).max(1_000_000), y: z.number().finite().min(-1_000_000).max(1_000_000),
    description: z.string().max(20_000).optional() }).strict(),
] as const;
export type Appearance = z.infer<typeof appearanceSchema>;
export type Series = z.infer<typeof seriesSchema>;
export const settingsSchema = z.object({ defaults: appearanceSchema, series: z.array(seriesSchema).max(2000),
  grid: gridSettingsSchema.default({}),
  background: backgroundSchema.default({}),
  name: deskNameSchema.default(''),
}).strict();
export type Settings = z.infer<typeof settingsSchema>;
type SettingsOperation = z.infer<typeof settingsOperations[number]>;
export const initialSettings = (): Settings => settingsSchema.parse({ defaults: {},
  series: [{ id: 'series-1', name: '数字' }] });
const katakana = [...'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン'];
const romans = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx'];
export function formatLimit(format: Series['format']) {
  if (format.includes('alpha')) return 26;
  if (format.includes('roman') || format === 'circled') return 20;
  return format === 'katakana' ? katakana.length : Number.MAX_SAFE_INTEGER;
}
export function formatNumber(format: Series['format'], number: number): string {
  const n = Math.min(number, formatLimit(format));
  switch (format) {
    case 'lower-alpha': return String.fromCharCode(96 + n);
    case 'upper-alpha': return String.fromCharCode(64 + n);
    case 'lower-roman': return romans[n - 1];
    case 'upper-roman': return romans[n - 1].toUpperCase();
    case 'circled': return String.fromCodePoint(0x2460 + n - 1);
    case 'katakana': return katakana[n - 1];
    default: return String(n);
  }
}
export function nextNumber(objects: DeskObject[], series: Series): number {
  const max = objects.reduce((value, object) => object.type === 'label' && object.seriesId === series.id
    ? Math.max(value, object.number ?? 0) : value, 0);
  return Math.min(max + 1, formatLimit(series.format));
}
export function creationAppearance(_type: DeskObject['type'], defaults: Appearance): Appearance {
  return { ...defaults };
}
export function materializeLabels(objects: DeskObject[], settings: Settings): DeskObject[] {
  return objects.map(object => {
    if (object.type !== 'label') return object;
    const series = settings.series.find(item => item.id === object.seriesId);
    if (!series || !object.number) throw new Error('Invalid label series or number');
    const { id: _id, name: _name, format, shape, visibility: _visibility, thread: _thread, ...style } = series;
    return { ...object, ...style, labelShape: shape, text: formatNumber(format, object.number) };
  });
}
export function applySettingsOperation(operation: SettingsOperation, objects: DeskObject[], settings: Settings): void {
  if (operation.kind === 'desk_rename') {
    settings.name = deskNameSchema.parse(operation.name);
  } else if (operation.kind === 'grid_update') {
    settings.grid = gridSettingsSchema.parse({ ...settings.grid, ...operation.patch });
  } else if (operation.kind === 'background_update') {
    settings.background = backgroundSchema.parse({ ...settings.background,
      ...(operation.patch.wallpaper !== undefined ? { selectionColor: null, pointingColor: null } : {}), ...operation.patch });
  } else if (operation.kind === 'defaults_update') {
    settings.defaults = appearanceSchema.parse({ ...settings.defaults, ...operation.patch });
  } else if (operation.kind === 'series_add') {
    if (settings.series.some(series => series.id === operation.series.id)) throw new Error('Duplicate series ID');
    const fontSize = operation.series.fontSize ?? settings.defaults.fontSize;
    const frame = tightFrame(fontSize, operation.series.shape ?? 'pin');
    settings.series.push(seriesSchema.parse({ ...settings.defaults, ...frame, ...operation.series }));
  } else if (operation.kind === 'series_update') {
    const index = settings.series.findIndex(series => series.id === operation.id);
    if (index < 0) throw new Error(`Unknown series: ${operation.id}`);
    settings.series[index] = seriesSchema.parse({ ...settings.series[index], ...operation.patch,
      thread: { ...settings.series[index].thread, ...operation.patch.thread } });
  } else {
    const series = settings.series.find(item => item.id === operation.seriesId);
    if (!series) throw new Error(`Unknown series: ${operation.seriesId}`);
    if (objects.some(object => object.id === operation.id)) throw new Error(`Duplicate ID: ${operation.id}`);
    if (objects.length >= 2000) throw new Error('Object limit reached');
    // The model validates and materializes this draft before committing it.
    objects.push({ id: operation.id, type: 'label', seriesId: series.id,
      number: nextNumber(objects, series), x: operation.x, y: operation.y,
      description: operation.description ?? '' } as DeskObject);
  }
}
