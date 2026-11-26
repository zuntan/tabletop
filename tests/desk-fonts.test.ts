import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Desk } from '../src/model';
import { deskFontsSchema, fontFamilies } from '../src/desk-fonts';
import { encodeDeskFile, decodeDeskFile } from '../src/desk-file';

test('font preferences accept ordered family lists and append generic fallbacks', () => {
  const fonts = deskFontsSchema.parse({ body: 'serif', sans: '"Noto Sans JP", Arial', serif: "'Noto Serif JP', Georgia", monospace: 'Consolas, "MS Gothic"' });
  assert.deepEqual(fontFamilies(fonts), { body: "'Noto Serif JP', Georgia, serif", code: 'Consolas, "MS Gothic", monospace' });
  assert.deepEqual(fontFamilies(), { body: 'sans-serif', code: 'monospace' });
  for (const value of ['Arial;', 'Arial,', 'url(https://example.com/font)', 'Arial\nserif', '"unfinished']) {
    assert.equal(deskFontsSchema.safeParse({ sans: value }).success, false, value);
  }
});

test('font changes use shared Undo and survive the existing archive format', async () => {
  const desk = new Desk();
  assert.equal(desk.settingsSnapshot().fonts, undefined);
  desk.execute({ operations: [{ kind: 'fonts_update', patch: { body: 'serif', serif: 'Georgia', monospace: 'Consolas' } }] });
  const fonts = desk.settingsSnapshot().fonts;
  desk.undo(); assert.equal(desk.settingsSnapshot().fonts, undefined);
  desk.redo(); assert.deepEqual(desk.settingsSnapshot().fonts, fonts);
  const decoded = await decodeDeskFile(await encodeDeskFile(desk));
  const restored = new Desk(); restored.replaceDocument({ objects: decoded.objects, settings: decoded.settings });
  assert.deepEqual(restored.settingsSnapshot().fonts, fonts);
  const revision = desk.revision;
  assert.throws(() => desk.execute({ operations: [{ kind: 'fonts_update', patch: { sans: 'Arial;' } }] }));
  assert.equal(desk.revision, revision);
});
