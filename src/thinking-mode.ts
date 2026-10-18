export const THINKING_MODE_REFUSAL = '利用者は今、ひとりで考えています。この操作は実行していません。解除を促したり、自動で再試行したりせず、依頼を待ってください。';
const readMethods = new Set(['summary', 'list', 'get', 'state', 'file_snapshot', 'settings', 'context', 'selection', 'changes', 'camera_get', 'share_read', 'text_measure']);

/** Human-only, per-tab UI state; reconnects and document loads do not change it. */
export function createThinkingMode(header: HTMLElement, onAlone: () => void, notify: (message: string) => void) {
  let alone = false;
  const button = document.createElement('button');
  button.id = 'thinking-mode';
  button.type = 'button';
  button.setAttribute('role', 'switch');
  button.setAttribute('aria-label', 'ひとりで考える');
  const label = document.createElement('span'); label.textContent = 'ひとりで考える';
  const track = document.createElement('span'); track.className = 'thinking-switch-track'; track.setAttribute('aria-hidden', 'true');
  const state = document.createElement('span'); state.className = 'thinking-switch-state'; state.setAttribute('aria-hidden', 'true');
  button.append(label, track, state);
  // Preserve native Space/Enter activation instead of canvas shortcuts.
  button.onkeydown = event => event.stopPropagation();
  const sync = () => {
    state.textContent = alone ? 'ON' : 'OFF';
    button.setAttribute('aria-checked', String(alone));
    button.title = 'ON：AIは読むだけ。OFF：AIといっしょに考える';
  };
  button.onclick = () => {
    alone = !alone;
    if (alone) onAlone();
    sync();
    notify(alone ? '今は少し、手を止めていてね。AIは読むことができ、人間の編集は続けられます。' : 'いっしょに考える時間です。止めた操作は自動では再実行しません。');
  };
  sync(); header.append(button);
  return {
    assertAllowed(method: string) {
      if (alone && !readMethods.has(method)) throw new Error(THINKING_MODE_REFUSAL);
    },
  };
}
