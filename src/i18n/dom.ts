import { languageChangeEvent, t } from './index';
import type { resources } from './resources';

type Paths<T> = { [K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K]>}` }[keyof T & string];
export type UiKey = Paths<typeof resources.en.common> | {
  [N in keyof typeof resources.en & string]: `${N}:${Paths<(typeof resources.en)[N]>}`
}[keyof typeof resources.en & string];

/** Only explicitly marked application UI participates; document content is never scanned for text. */
export function translateUi(root: ParentNode = document) {
  const nodes = [...root.querySelectorAll<HTMLElement>('[data-i18n], [data-i18n-title], [data-i18n-aria-label], [data-i18n-placeholder], [data-i18n-alt]')];
  if (root instanceof Element) nodes.unshift(root as HTMLElement);
  for (const node of nodes) {
    const refs = JSON.parse(node.getAttribute('data-i18n-refs') ?? '{}') as Record<string, UiKey>;
    const args = Object.fromEntries(Object.entries(refs).map(([name, key]) => [name, t(key)]));
    const key = node.getAttribute('data-i18n');
    if (key) node.textContent = t(key as UiKey, { replace: args });
    for (const attribute of ['title', 'aria-label', 'placeholder', 'alt']) {
      const key = node.getAttribute(`data-i18n-${attribute}`);
      if (key) node.setAttribute(attribute, t(key as UiKey, { replace: args }));
    }
  }
}

export function uiText<T extends Element>(node: T, key: UiKey): T {
  node.setAttribute('data-i18n', key); node.textContent = t(key); return node;
}
export function uiAttribute<T extends Element>(node: T, attribute: 'title' | 'aria-label' | 'placeholder' | 'alt', key: UiKey, refs?: Record<string, UiKey>): T {
  if (refs) node.setAttribute('data-i18n-refs', JSON.stringify(refs));
  node.setAttribute(`data-i18n-${attribute}`, key);
  const args = Object.fromEntries(Object.entries(refs ?? {}).map(([name, key]) => [name, t(key)]));
  node.setAttribute(attribute, t(key, { replace: args })); return node;
}
if (typeof document !== 'undefined') document.addEventListener(languageChangeEvent, () => translateUi());
