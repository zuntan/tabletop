import { uiAttribute } from './i18n/dom';
import { t } from './i18n';
import QRCode from 'qrcode';
import { headerIcon } from './header-icon';
import { confirmAction } from './confirm-dialog';

/** Connection secrets live in this panel only, never in the desk model. */
export function connectionControls(root: HTMLElement, handoff: () => void, error: (message: string) => void) {
  const input = root.querySelector<HTMLInputElement>('#connection-url')!;
  const show = root.querySelector<HTMLButtonElement>('#connection-show')!;
  const clear = root.querySelector<HTMLButtonElement>('#connection-clear')!;
  const panel = root.querySelector<HTMLElement>('#handoff-panel')!;
  const canvas = root.querySelector<HTMLCanvasElement>('#handoff-qr')!;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  const mask = () => { input.type = 'password'; headerIcon(show, 'eye', t('editing:showUrl'));uiAttribute(show,'title','editing:showUrl');uiAttribute(show,'aria-label','editing:showUrl'); show.setAttribute('aria-pressed', 'false'); };
  mask(); headerIcon(clear, 'clear', t('editing:clearUrl'));uiAttribute(clear,'title','editing:clearUrl');uiAttribute(clear,'aria-label','editing:clearUrl');
  show.onclick = () => {
    if (input.type === 'text') mask();
    else { input.type = 'text'; headerIcon(show, 'eyeOff', t('editing:hideUrl'));uiAttribute(show,'title','editing:hideUrl');uiAttribute(show,'aria-label','editing:hideUrl'); show.setAttribute('aria-pressed', 'true'); }
  };
  clear.onclick = () => { input.value = ''; mask(); input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); };
  const hide = () => { clearTimeout(expiry); panel.hidden = true; canvas.width = 0; canvas.height = 0; };
  root.querySelector<HTMLButtonElement>('#handoff-hide')!.onclick = hide;
  root.querySelector<HTMLButtonElement>('#handoff-start')!.onclick = async () => {
    if (!await confirmAction(t('editing:handoffTitle'),t('editing:handoffMessage'),t('editing:release'))) return;
    hide();
    try { handoff(); } catch (cause) { error(cause instanceof Error ? cause.message : String(cause)); }
  };
  return {
    hide,
    async display(url: string) {
      try {
        await QRCode.toCanvas(canvas, url, { width: 256, margin: 4, errorCorrectionLevel: 'M' });
        panel.hidden = false;
        expiry = setTimeout(hide, 300_000);
      } catch { hide(); error(t('editing:qrFailedReleased')); }
    },
  };
}
