import { z } from 'zod';

/** A document name, not an identifier or a filesystem path. Empty means untitled. */
export const deskNameSchema = z.string().trim().max(100).refine(value => !/[\u0000-\u001f\u007f\u2028\u2029]/u.test(value), 'Desk names must be a single line');

/** A public per-tab hint, not a credential or a guaranteed globally unique ID. */
export function createDeskId() {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const text = Array.from(bytes, byte => alphabet[byte & 31]).join('');
  return `${text.slice(0, 4)}-${text.slice(4)}`;
}

/** Only the suggested download filename is sanitized; the document name stays unchanged. */
export function downloadDeskFilename(name: string) {
  let stem = name.trim().replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/gu, '_').replace(/[. ]+$/u, '');
  // Leave room for the extension and browser duplicate suffix on common filesystems.
  while (new TextEncoder().encode(stem).length > 200) stem = Array.from(stem).slice(0, -1).join('');
  stem = stem.replace(/[. ]+$/u, '') || '無題';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(stem)) stem = `_${stem}`;
  return `${stem}.tabletop`;
}
