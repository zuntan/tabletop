import { createInstance } from 'i18next';
import { resources, type UiLanguage } from './resources';

export const languageStorageKey = 'tabletop.ui.language';
export const languageChangeEvent = 'tabletop-language-change';

export function isUiLanguage(value: unknown): value is UiLanguage {
  return typeof value === 'string' && Object.hasOwn(resources, value);
}

/** Explicit preference wins; only the primary browser language chooses the initial locale. */
export function initialLanguage(stored: unknown, browserLanguage: string): UiLanguage {
  if (isUiLanguage(stored)) return stored;
  return /^ja(?:-|$)/i.test(browserLanguage) ? 'ja' : 'en';
}

export function createUiI18n(language: UiLanguage) {
  const instance = createInstance();
  void instance.init({ resources: structuredClone(resources), lng: language, supportedLngs: Object.keys(resources), fallbackLng: 'en',
    defaultNS: 'common', initAsync: false, returnNull: false,
    parseMissingKeyHandler: key => { console.warn(`[Tabletop i18n] Missing key: ${key}`); return key; },
    // Callers assign textContent/attributes. Never insert translated strings as raw HTML.
    interpolation: { escapeValue: false } });
  return instance;
}

function storedLanguage(): string | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage.getItem(languageStorageKey); }
  catch { return null; }
}

export const uiI18n = createUiI18n(initialLanguage(storedLanguage(), typeof navigator === 'undefined' ? 'en' : navigator.language));
export const t = uiI18n.t.bind(uiI18n);
export const getUiLanguage = () => uiI18n.resolvedLanguage as UiLanguage;

function updateDocumentLanguage() {
  if (typeof document !== 'undefined') document.documentElement.lang = getUiLanguage();
}
updateDocumentLanguage();

/** Local display preference only. No desk action, reconnect, reload or shared history entry. */
export async function setUiLanguage(language: UiLanguage) {
  if (!isUiLanguage(language)) throw new Error('Unsupported UI language');
  await uiI18n.changeLanguage(language);
  try { localStorage.setItem(languageStorageKey, language); } catch { /* Keep the preference in memory. */ }
  updateDocumentLanguage();
  if (typeof document !== 'undefined') document.dispatchEvent(new Event(languageChangeEvent));
}
