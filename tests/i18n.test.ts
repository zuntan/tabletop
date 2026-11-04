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
