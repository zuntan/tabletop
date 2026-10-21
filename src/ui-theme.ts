import { createIcon } from './icons';

const storageKey = 'tabletop-ui-theme';
export type UiTheme = 'light' | 'dark';

function storedTheme(): UiTheme {
  try { return localStorage.getItem(storageKey) === 'dark' ? 'dark' : 'light'; }
  catch { return 'light'; }
}
// Apply before building the UI; this preference never enters the desk document.
document.documentElement.dataset.theme = storedTheme();

export function getUiTheme(): UiTheme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}
export function setUiTheme(theme: UiTheme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(storageKey, theme); } catch { /* Storage may be unavailable. */ }
  document.dispatchEvent(new Event('ui-theme-change'));
  return { theme };
}

export function createUiThemeButton(header: HTMLElement) {
  const button = document.createElement('button'); button.type = 'button'; button.id = 'ui-theme'; button.className = 'header-icon';
  function update() {
    const dark = document.documentElement.dataset.theme === 'dark';
    const label = dark ? 'ライトモードに切替' : 'ダークモードに切替';
    button.title = label; button.setAttribute('aria-label', label); button.setAttribute('aria-pressed', String(dark));
    button.replaceChildren(createIcon(dark ? 'sun' : 'moon', 20));
  }
  button.onclick = () => setUiTheme(getUiTheme() === 'dark' ? 'light' : 'dark');
  document.addEventListener('ui-theme-change', update);
  header.insertBefore(button, header.querySelector('#file-menu') ?? header.querySelector('#save-desk')); update();
}
