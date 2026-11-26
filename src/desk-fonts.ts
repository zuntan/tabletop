import { z } from 'zod';

// Font-family names only. CSS declarations, functions and control characters are not accepted.
const family = String.raw`(?:"[^"\\\x00-\x1f]+"|'[^'\\\x00-\x1f]+'|[\p{L}_-][\p{L}\p{N}_ -]*)`;
const familyList = new RegExp(`^${family}(?:\\s*,\\s*${family})*$`, 'u');
const fontCandidates = z.string().trim().max(1000).refine(value => value === '' || familyList.test(value));
export const deskFontsSchema = z.object({
  body: z.enum(['sans', 'serif', 'monospace']).default('sans'),
  sans: fontCandidates.default(''),
  serif: fontCandidates.default(''),
  monospace: fontCandidates.default(''),
}).strict();
export type DeskFonts = z.infer<typeof deskFontsSchema>;
export const fontDefaultsKey = 'tabletop.font-defaults';

export function fontFamilies(fonts?: DeskFonts) {
  const settings = fonts ?? deskFontsSchema.parse({});
  const stack = (key: 'sans' | 'serif' | 'monospace') => {
    const fallback = key === 'sans' ? 'sans-serif' : key;
    return settings[key] ? `${settings[key]}, ${fallback}` : fallback;
  };
  return { body: stack(settings.body), code: stack('monospace') };
}

export function readFontDefaults(): DeskFonts | undefined {
  try {
    const value = localStorage.getItem(fontDefaultsKey);
    if (!value) return undefined;
    const parsed = deskFontsSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : undefined;
  } catch { return undefined; }
}

export function saveFontDefaults(fonts: DeskFonts) {
  try { localStorage.setItem(fontDefaultsKey, JSON.stringify(deskFontsSchema.parse(fonts))); }
  catch { /* The current desk still retains its settings when browser storage is unavailable. */ }
}
