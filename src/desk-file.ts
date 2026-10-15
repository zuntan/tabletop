import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { z } from 'zod';
import { Desk } from './model';
import { zipChecksums, verifyZipEntries } from './zip-integrity';

export const MAX_DESK_FILE_BYTES = 50 * 1024 * 1024;
const MAX_ASSET_BYTES = 5 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 16 * 1024 * 1024;
const assetPath = /^assets\/[a-f0-9]{64}\.(png|jpeg|gif|webp|svg)$/;
const mimeExtensions: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpeg',
  'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg' };
const manifestSchema = z.object({ format: z.literal('tabletop'), version: z.literal(1),
  objects: z.array(z.record(z.unknown())).max(2000), settings: z.unknown(),
  assets: z.record(z.object({ path: z.string().regex(assetPath),
    mime: z.enum(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']) }).strict()),
}).strict();
const missingSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160"><rect width="320" height="160" fill="#f1f5f9"/><text x="160" y="85" text-anchor="middle" fill="#64748b" font-size="18">Missing image</text></svg>';
const missingSource = `data:image/svg+xml;base64,${btoa(missingSvg)}`;
function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
async function digest(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
function validateDocument(input: unknown) {
  const validator = new Desk();
  validator.replaceDocument(input);
  return { objects: validator.snapshot(), settings: validator.settingsSnapshot() };
}

/** No remote URL is fetched. All archive operations stay in memory. */
export async function encodeDeskFile(desk: Desk): Promise<Uint8Array> {
  const document = validateDocument({ objects: desk.snapshot(), settings: desk.settingsSnapshot() });
  const files: Record<string, Uint8Array> = Object.create(null);
  const assets: Record<string, { path: string; mime: string }> = Object.create(null);
  let total = 0;
  const objects: Record<string, unknown>[] = [];
  for (const object of document.objects) {
    const copy: Record<string, unknown> = { ...object };
    if (object.src?.startsWith('data:')) {
      const match = /^data:(image\/(?:png|jpeg|gif|webp|svg\+xml));base64,([A-Za-z0-9+/=\s]+)$/.exec(object.src);
      if (!match) throw new Error('Invalid embedded image');
      const bytes = Uint8Array.from(atob(match[2].replace(/\s/g, '')), char => char.charCodeAt(0));
      if (!bytes.length || bytes.length > MAX_ASSET_BYTES) throw new Error('Image exceeds 5 MiB');
      const hash = await digest(bytes);
      const path = `assets/${hash}.${mimeExtensions[match[1]]}`;
      if (!files[path]) { files[path] = bytes; total += bytes.length; }
      if (total > MAX_DESK_FILE_BYTES) throw new Error('Desk exceeds 50 MiB');
      assets[object.id] = { path, mime: match[1] };
      delete copy.src;
    }
    objects.push(copy);
  }
  files['manifest.json'] = strToU8(JSON.stringify({ format: 'tabletop', version: 1, objects, settings: document.settings, assets }));
  if (files['manifest.json'].length > MAX_MANIFEST_BYTES) throw new Error('Manifest exceeds 16 MiB');
  const archive = zipSync(files, { level: 0 });
  if (archive.length > MAX_DESK_FILE_BYTES) throw new Error('Desk file exceeds 50 MiB');
  return archive;
}

export async function decodeDeskFile(bytes: Uint8Array) {
  if (bytes.length > MAX_DESK_FILE_BYTES) throw new Error('Desk file exceeds 50 MiB');
  const checksums = zipChecksums(bytes);
  const names = new Set<string>();
  let total = 0;
  const files = unzipSync(bytes, { filter: file => {
    if (names.has(file.name) || names.size >= 2001) throw new Error('Duplicate or excessive ZIP entries');
    names.add(file.name);
    if (file.name !== 'manifest.json' && !assetPath.test(file.name)) throw new Error('Invalid ZIP entry path');
    const limit = file.name === 'manifest.json' ? MAX_MANIFEST_BYTES : MAX_ASSET_BYTES;
    total += file.originalSize;
    if (file.originalSize > limit || total > MAX_DESK_FILE_BYTES) throw new Error('Expanded archive exceeds limit');
    return true;
  } });
  verifyZipEntries(files, checksums);
  if (!files['manifest.json']) throw new Error('Missing manifest.json');
  const manifest = manifestSchema.parse(JSON.parse(strFromU8(files['manifest.json'])));
  const ids = new Set(manifest.objects.map(object => object.id));
  const warnings: string[] = [];
  const sources = new Map<string, string>();
  for (const [id, asset] of Object.entries(manifest.assets)) {
    if (!ids.has(id) || !asset.path.endsWith(`.${mimeExtensions[asset.mime]}`)) throw new Error('Invalid asset reference');
    const data = files[asset.path];
    if (!data) { warnings.push(id); sources.set(id, missingSource); continue; }
    if (!data.length || await digest(data) !== asset.path.slice(7, 71)) throw new Error('Corrupt asset');
    sources.set(id, `data:${asset.mime};base64,${base64(data)}`);
  }
  const objects = manifest.objects.map(object => {
    const src = sources.get(String(object.id));
    if (src && (object.src !== undefined || !['image', 'svg'].includes(String(object.type)))) throw new Error('Conflicting asset reference');
    return src ? { ...object, src } : object;
  });
  return { ...validateDocument({ objects, settings: manifest.settings }), warnings };
}
