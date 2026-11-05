import { languageChangeEvent, t } from './index';
import type { resources } from './resources';

type Paths<T> = { [K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K]>}` }[keyof T & string];
export type UiKey = Paths<typeof resources.en.common> | {
  [N in keyof typeof resources.en & string]: `${N}:${Paths<(typeof resources.en)[N]>}`
}[keyof typeof resources.en & string];

type UiValues = Record<string, string | number>;
function messageArgs(node: Element) {
  const values = JSON.parse(node.getAttribute('data-i18n-values') ?? '{}') as UiValues;
  const refs = JSON.parse(node.getAttribute('data-i18n-refs') ?? '{}') as Record<string, UiKey>;
  return { ...values, ...Object.fromEntries(Object.entries(refs).map(([name, key]) => [name, t(key)])) };
}
function uiMessage(key: UiKey, args: UiValues) {
  return t(key, { replace: args, ...(typeof args.count === 'number' ? { count: args.count } : {}) });
}
function rememberArgs(node: Element, values?: UiValues, refs?: Record<string, UiKey>) {
  if (values) node.setAttribute('data-i18n-values', JSON.stringify(values));
  if (refs) node.setAttribute('data-i18n-refs', JSON.stringify(refs));
}

/** Only explicitly marked application UI participates; document content is never scanned for text. */
export function translateUi(root: ParentNode = document) {
  const nodes = [...root.querySelectorAll<HTMLElement>('[data-i18n], [data-i18n-title], [data-i18n-aria-label], [data-i18n-placeholder], [data-i18n-alt]')];
  if (root instanceof Element) nodes.unshift(root as HTMLElement);
  for (const node of nodes) {
    const args = messageArgs(node);
    const key = node.getAttribute('data-i18n');
    if (key) node.textContent = uiMessage(key as UiKey, args);
    for (const attribute of ['title', 'aria-label', 'placeholder', 'alt']) {
      const key = node.getAttribute(`data-i18n-${attribute}`);
      if (key) node.setAttribute(attribute, uiMessage(key as UiKey, args));
    }
  }
}

export function uiText<T extends Element>(node: T, key: UiKey, values?: UiValues, refs?: Record<string, UiKey>): T {
  rememberArgs(node, values, refs);
  node.setAttribute('data-i18n', key); node.textContent = uiMessage(key, messageArgs(node)); return node;
}
export function uiAttribute<T extends Element>(node: T, attribute: 'title' | 'aria-label' | 'placeholder' | 'alt', key: UiKey, refs?: Record<string, UiKey>, values?: UiValues): T {
  rememberArgs(node, values, refs);
  node.setAttribute(`data-i18n-${attribute}`, key);
  node.setAttribute(attribute, uiMessage(key, messageArgs(node))); return node;
}
if (typeof document !== 'undefined') document.addEventListener(languageChangeEvent, () => translateUi());
