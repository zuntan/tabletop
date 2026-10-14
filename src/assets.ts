import { constants } from 'node:fs';
import { open, realpath, mkdtemp, writeFile } from 'node:fs/promises';
import { isAbsolute, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

export const assetLimit = 5_000_000;
export type Asset = { bytes: Buffer; mimeType: string; src: string };
export function assetFromBytes(bytes: Buffer): Asset {
  if (!bytes.length || bytes.length > assetLimit) throw new Error('Asset must be between 1 byte and 5MB');
  let mimeType: string;
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) mimeType = 'image/png';
  else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) mimeType = 'image/jpeg';
  else if (/^GIF8[79]a$/.test(bytes.subarray(0, 6).toString())) mimeType = 'image/gif';
  else if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') mimeType = 'image/webp';
  else {
    const source = bytes.toString('utf8').trim();
    const root = source.replace(/^<\?xml[^]*?\?>\s*/i, '').split('>')[0];
    if (/<!DOCTYPE|<!ENTITY/i.test(source) || !/^<svg\s/i.test(root) ||
      !/\sxmlns\s*=\s*['"]http:\/\/www\.w3\.org\/2000\/svg['"]/.test(root)) {
      throw new Error('Supported assets: PNG, JPEG, GIF, WebP, standalone SVG without DOCTYPE/ENTITY');
    }
    mimeType = 'image/svg+xml';
  }
  return { bytes, mimeType, src: `data:${mimeType};base64,${bytes.toString('base64')}` };
}

export async function importAssetFile(path: string, allowedRoot = process.env.TABLETOP_ASSET_ROOT ?? tmpdir()): Promise<Asset> {
  if (!isAbsolute(path)) throw new Error('Asset path must be absolute');
  const root = await realpath(resolve(allowedRoot));
  const canonical = await realpath(path);
  if (!canonical.startsWith(root + sep)) throw new Error('Asset path is outside TABLETOP_ASSET_ROOT');
  const file = await open(canonical, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = await file.stat();
    if (!info.isFile() || info.size > assetLimit) throw new Error('Asset must be a regular file of at most 5MB');
    // Compare the open file with its checked path before reading any contents.
    const checked = await realpath(canonical);
    if (!checked.startsWith(root + sep)) throw new Error('Asset path changed outside allowed root');
    const check = await open(checked, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const other = await check.stat();
      if (other.ino !== info.ino || other.dev !== info.dev) throw new Error('Asset file changed during opening');
    } finally { await check.close(); }
    const buffer = Buffer.alloc(assetLimit + 1); let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await file.read(buffer, length, buffer.length - length, length);
      if (!bytesRead) break;
      length += bytesRead;
    }
    return assetFromBytes(buffer.subarray(0, length));
  } finally { await file.close(); }
}

export function embeddedAsset(src: string): Asset {
  const match = /^data:(image\/(?:png|jpeg|gif|webp|svg\+xml));base64,([A-Za-z0-9+/=\s]+)$/.exec(src);
  if (!match) throw new Error('Asset is remote. The server does not fetch URLs; supply a local file to import it first');
  if (match[2].length > 8_000_000) throw new Error('Asset exceeds size limit');
  const asset = assetFromBytes(Buffer.from(match[2], 'base64'));
  if (asset.mimeType !== match[1]) throw new Error('Image MIME type does not match its content');
  return asset;
}

let exportDirectory: Promise<string> | undefined;
let exportedBytes = 0;
export async function exportAsset(asset: Asset): Promise<string> {
  if (exportedBytes + asset.bytes.length > 100_000_000) throw new Error('Export limit reached: 100MB per server process');
  exportedBytes += asset.bytes.length;
  exportDirectory ??= mkdtemp(resolve(tmpdir(), 'tabletop-assets-'));
  const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg' }[asset.mimeType];
  const path = resolve(await exportDirectory, `${randomUUID()}.${extension}`);
  await writeFile(path, asset.bytes, { flag: 'wx', mode: 0o600 });
  return path;
}
