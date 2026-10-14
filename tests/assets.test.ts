import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, symlink, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { assetFromBytes, embeddedAsset, importAssetFile, exportAsset, assetLimit } from '../src/assets';

const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><rect width="80" height="40"/></svg>';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
test('assets detect supported formats, cap sizes and reject unsafe SVG declarations or MIME mismatches', () => {
  const raster = assetFromBytes(png); assert.equal(raster.mimeType, 'image/png');
  assert.deepEqual(embeddedAsset(raster.src).bytes, png);
  assert.equal(assetFromBytes(Buffer.from(svg)).mimeType, 'image/svg+xml');
  assert.throws(() => assetFromBytes(Buffer.alloc(assetLimit + 1)));
  assert.throws(() => assetFromBytes(Buffer.from('<!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg"/>')));
  assert.throws(() => assetFromBytes(Buffer.from('plain text')));
  assert.throws(() => embeddedAsset('https://example.com/image.png'));
  assert.throws(() => embeddedAsset(raster.src.replace('image/png', 'image/jpeg')));
});
test('file bridge confines reads and exports private files without overwriting caller paths', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'tabletop-asset-test-'));
  const path = resolve(root, 'input.svg'); await writeFile(path, svg);
  assert.equal((await importAssetFile(path, root)).mimeType, 'image/svg+xml');
  await assert.rejects(importAssetFile('relative.svg', root));
  await assert.rejects(importAssetFile(resolve('README.md'), root), /outside/);
  await symlink(resolve('README.md'), resolve(root, 'escape.svg'));
  await assert.rejects(importAssetFile(resolve(root, 'escape.svg'), root), /outside/);
  await assert.rejects(importAssetFile(root, tmpdir()), /regular file/);
  const exported = await exportAsset(assetFromBytes(png));
  assert.deepEqual(await readFile(exported), png);
  assert.equal((await stat(exported)).mode & 0o777, 0o600);
  assert.equal((await stat(resolve(exported, '..'))).mode & 0o777, 0o700);
});
