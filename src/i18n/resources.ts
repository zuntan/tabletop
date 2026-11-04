import enCommon from './en/common.json';
import enMenu from './en/menu.json';
import enMessages from './en/messages.json';
import jaCommon from './ja/common.json';
import jaMenu from './ja/menu.json';
import jaMessages from './ja/messages.json';

// English is the complete source catalog. Every locale uses the same namespaces.
export const resources = {
  en: { common: enCommon, menu: enMenu, messages: enMessages },
  ja: { common: jaCommon, menu: jaMenu, messages: jaMessages },
};
export type UiLanguage = keyof typeof resources;

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: typeof resources.en;
    returnNull: false;
    strictKeyChecks: true;
  }
}

function stringKeys(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid translation value: ${prefix}`);
  return Object.entries(value).flatMap(([key, entry]) => stringKeys(entry, prefix ? `${prefix}.${key}` : key));
}

/** Used by the pre-build check; fallback is a runtime safeguard, not permission to omit translations. */
export function checkResourceKeys(catalogs: Record<string, unknown>): string[] {
  const source = new Set(stringKeys(catalogs.en));
  const errors: string[] = [];
  for (const [language, catalog] of Object.entries(catalogs)) {
    const keys = new Set(stringKeys(catalog));
    for (const key of source) if (!keys.has(key)) errors.push(`${language}: missing ${key}`);
    for (const key of keys) if (!source.has(key)) errors.push(`${language}: unknown ${key}`);
  }
  return errors;
}
