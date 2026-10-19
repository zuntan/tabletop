import { createIcon } from './icons';
import { renderMarkdown } from './markdown';

/** A held view of the draft, never a write to the desk or a second editor. */
export function createMarkdownPreview(panel: HTMLElement, input: HTMLTextAreaElement, actions: HTMLElement) {
  const button = document.createElement('button'); button.type = 'button'; button.className = 'editor-preview-toggle';
  button.append(createIcon('eye', 18)); button.title = '押している間だけMarkdownを確認';
  button.setAttribute('aria-label', 'Markdownプレビュー'); button.setAttribute('aria-pressed', 'false');
  const preview = document.createElement('div'); preview.className = 'markdown-text editor-markdown-preview'; preview.hidden = true;
  preview.setAttribute('aria-label', '未確定のMarkdownプレビュー'); preview.inert = true;
  panel.append(preview); actions.append(button);
  let showing = false;
  const stop = (returnFocus = false) => {
    const wasShowing = showing;
    showing = false; preview.hidden = true; input.style.visibility = ''; button.setAttribute('aria-pressed', 'false');
    if (wasShowing && returnFocus && input.isConnected) input.focus({ preventScroll: true });
  };
  const start = () => {
    if (showing) return;
    showing = true;
    const style = getComputedStyle(input);
    Object.assign(preview.style, { left: `${input.offsetLeft}px`, top: `${input.offsetTop}px`,
      width: `${input.offsetWidth}px`, height: `${input.offsetHeight}px`,
      background: style.backgroundColor, color: style.color, border: style.border,
      borderRadius: style.borderRadius, padding: style.padding, fontSize: style.fontSize });
    preview.innerHTML = renderMarkdown(input.value);
    preview.hidden = false; input.style.visibility = 'hidden'; button.setAttribute('aria-pressed', 'true');
  };
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault(); button.setPointerCapture(event.pointerId); start();
  });
  button.addEventListener('pointerup', () => stop(true));
  button.addEventListener('pointercancel', () => stop(true));
  button.addEventListener('lostpointercapture', () => stop());
  button.addEventListener('keydown', event => {
    if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); start(); }
  });
  button.addEventListener('keyup', event => {
    if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); stop(true); }
  });
  const blur = () => stop();
  button.addEventListener('blur', blur);
  window.addEventListener('blur', blur);
  return () => { window.removeEventListener('blur', blur); stop(); };
}
