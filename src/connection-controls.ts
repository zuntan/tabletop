import QRCode from 'qrcode';
import { headerIcon } from './header-icon';

/** Connection secrets live in this panel only, never in the desk model. */
export function connectionControls(root: HTMLElement, handoff: () => void, error: (message: string) => void) {
  const input = root.querySelector<HTMLInputElement>('#connection-url')!;
  const show = root.querySelector<HTMLButtonElement>('#connection-show')!;
  const clear = root.querySelector<HTMLButtonElement>('#connection-clear')!;
  const panel = root.querySelector<HTMLElement>('#handoff-panel')!;
  const canvas = root.querySelector<HTMLCanvasElement>('#handoff-qr')!;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  const mask = () => { input.type = 'password'; headerIcon(show, 'eye', 'URLを表示'); show.setAttribute('aria-pressed', 'false'); };
  mask(); headerIcon(clear, 'clear', 'URLをクリア');
  show.onclick = () => {
    if (input.type === 'text') mask();
    else { input.type = 'text'; headerIcon(show, 'eyeOff', 'URLを隠す'); show.setAttribute('aria-pressed', 'true'); }
  };
  clear.onclick = () => { input.value = ''; mask(); input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); };
  const hide = () => { clearTimeout(expiry); panel.hidden = true; canvas.width = 0; canvas.height = 0; };
  root.querySelector<HTMLButtonElement>('#handoff-hide')!.onclick = hide;
  root.querySelector<HTMLButtonElement>('#handoff-start')!.onclick = () => {
    if (!confirm('この机のAI接続を解放して、別端末向けのQRを表示しますか？机の内容は移動しません。必要なら先に保存してください。')) return;
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
      } catch { hide(); error('QRを表示できませんでした。接続は解放済みです。'); }
    },
  };
}
