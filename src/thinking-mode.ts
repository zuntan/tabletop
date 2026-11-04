import { t, languageChangeEvent } from './i18n';
import { uiText, uiAttribute } from './i18n/dom';
export const THINKING_MODE_REFUSAL = '利用者は今、ひとりで考えています。この操作は実行していません。解除を促したり、自動で再試行したりせず、依頼を待ってください。';
const readMethods = new Set(['summary', 'list', 'get', 'state', 'file_snapshot', 'file_saved', 'settings', 'context', 'selection', 'changes', 'camera_get', 'ui_get', 'share_read', 'text_measure', 'mermaid_render', 'qr_render', 'raster', 'pdf_export']);

/** Human-only, per-tab UI state; reconnects and document loads do not change it. */
export function createThinkingMode(header: HTMLElement, onAlone: () => void, notify: (message: string) => void) {
  let alone = false;
  const button = document.createElement('button');
  button.id = 'thinking-mode';
  button.type = 'button';
  button.setAttribute('role', 'switch');
  uiAttribute(button, 'aria-label', 'controls:alone');
  const label = document.createElement('span'); uiText(label, 'controls:alone');
  const track = document.createElement('span'); track.className = 'thinking-switch-track'; track.setAttribute('aria-hidden', 'true');
  const state = document.createElement('span'); state.className = 'thinking-switch-state'; state.setAttribute('aria-hidden', 'true');
  button.append(label, track, state);
  // Preserve native Space/Enter activation instead of canvas shortcuts.
  button.onkeydown = event => event.stopPropagation();
  const sync = () => {
    state.textContent = alone ? 'ON' : 'OFF';
    button.setAttribute('aria-checked', String(alone));
    button.title = t('controls:aloneHint');
  };
  button.onclick = () => {
    alone = !alone;
    if (alone) onAlone();
    sync();
    notify(alone ? t('controls:aloneOn') : t('controls:aloneOff'));
  };
  document.addEventListener(languageChangeEvent, sync);
  sync(); header.append(button);
  return {
    assertAllowed(method: string) {
      if (alone && !readMethods.has(method)) throw new Error(THINKING_MODE_REFUSAL);
    },
  };
}
