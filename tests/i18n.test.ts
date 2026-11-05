import test from 'node:test';
import assert from 'node:assert/strict';
import { checkResourceKeys, resources } from '../src/i18n/resources';
import { createUiI18n, initialLanguage } from '../src/i18n';
import { FILE_EXISTS_MESSAGE, isFileExistsError } from '../src/file-errors';

test('initial UI locale honors an explicit preference, Japanese browser regions, and English fallback', () => {
  assert.equal(initialLanguage('en', 'ja-JP'), 'en');
  assert.equal(initialLanguage('ja', 'fr-FR'), 'ja');
  assert.equal(initialLanguage(null, 'ja'), 'ja');
  assert.equal(initialLanguage(null, 'ja-JP'), 'ja');
  assert.equal(initialLanguage(null, 'JA-jp'), 'ja');
  for (const language of ['en-US', 'fr-FR', 'es-ES', 'zh-CN', '', 'javascript']) {
    assert.equal(initialLanguage(null, language), 'en');
  }
  assert.equal(initialLanguage('unsupported', 'ja-JP'), 'ja');
});

test('catalog check rejects missing, extra, and non-string translation entries', () => {
  assert.deepEqual(checkResourceKeys(resources), []);
  assert.deepEqual(checkResourceKeys({ en: { text: 'English' }, ja: {} }), ['ja: missing text']);
  assert.deepEqual(checkResourceKeys({ en: { text: 'English' }, ja: { text: 'Japanese', extra: 'extra' } }), ['ja: unknown extra']);
  assert.throws(() => checkResourceKeys({ en: { text: 42 } }), /Invalid translation/);
  assert.throws(() => checkResourceKeys({ ja: {} }), /Invalid translation/);
});

test('instances isolate display languages and a missing translation falls back to the English source', async () => {
  const english = createUiI18n('en'), japanese = createUiI18n('ja');
  assert.equal(english.t('undo'), 'Undo');
  assert.equal(japanese.t('undo'), '元に戻す');
  japanese.removeResourceBundle('ja', 'common');
  assert.equal(japanese.t('undo'), 'Undo');
  await english.changeLanguage('ja');
  assert.equal(english.t('undo'), '元に戻す');
  assert.equal(japanese.resolvedLanguage, 'ja');
  assert.equal(japanese.t('undo'), 'Undo');
});

test('file collision handling uses the canonical transport message rather than translated UI text', () => {
  assert.equal(isFileExistsError(new Error(FILE_EXISTS_MESSAGE)), true);
  assert.equal(isFileExistsError(new Error(resources.ja.messages.fileExists)), false);
  assert.equal(isFileExistsError(new Error('Some unrelated filesystem error')), false);
});

test('localized badge labels cover all existing symbols, placements, sticker shapes and stamp designs', async () => {
  const { reactions } = await import('../src/reaction-values');
  const { reactionPlacements } = await import('../src/reaction-layout');
  const { stickerShapeIds } = await import('../src/sticker-shapes');
  const { stampPatterns } = await import('../src/stamp-values');
  const sorted = (values: readonly string[]) => [...values].sort();
  const catalog = resources.en.badges;
  assert.deepEqual(sorted(Object.keys(catalog.reactions)), sorted(reactions));
  assert.deepEqual(sorted(Object.keys(catalog.placements)), sorted(reactionPlacements));
  assert.deepEqual(sorted(Object.keys(catalog.shapes)), sorted(stickerShapeIds));
  assert.deepEqual(sorted(Object.keys(catalog.stamps)), sorted(stampPatterns.map(pattern => pattern.id)));
  const english = createUiI18n('en');
  assert.equal(english.t('badges:stamps.done_ja'), '済 — Completed');
  assert.equal(stampPatterns.find(pattern => pattern.id === 'done_ja')!.title, '済');
});

test('counted notices choose natural English singular and plural forms',()=>{
 const english=createUiI18n('en'),japanese=createUiI18n('ja');
 assert.equal(english.t('messages:copied',{count:1,scope:''}),'Copied 1 item');
 assert.equal(english.t('messages:copied',{count:2,scope:''}),'Copied 2 items');
 assert.equal(japanese.t('messages:copied',{count:1,scope:''}),'1パーツをコピーしました');
 assert.equal(english.t('actions:linesCreated',{count:1}),'Created 1 line');
});
