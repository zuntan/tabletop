import { t, getUiLanguage } from './i18n';
import type { DeskObject } from './model';
import { renderMermaid } from './mermaid-card';
import { renderQrCode } from './qr-code';
import { doodleSource } from './doodle-values';

let lookup: (id: string) => DeskObject | undefined = () => undefined;
/** One desk per browser window; previews share the canvas's live lookup. */
export function configureMarkdownImages(resolve: typeof lookup) { lookup = resolve; }

export function markdownImageReference(source: string): { kind: 'local'; id: string } | { kind: 'external'; src: string } | undefined {
  if (source.startsWith('tabletop://./')) {
    const id = source.slice('tabletop://./'.length);
    if (!id || /[/?#]/.test(id)) return undefined;
    try { return { kind: 'local', id: decodeURIComponent(id) }; } catch { return undefined; }
  }
  try {
    const url = new URL(source);
    if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return { kind: 'external', src: url.href };
  } catch { /* Unsupported references are displayed as unavailable. */ }
  return undefined;
}

async function resolveSource(source: string): Promise<string> {
  const ref = markdownImageReference(source);
  if (!ref) throw new Error('Unsupported image reference');
  if (ref.kind === 'external') return ref.src;
  const object = lookup(ref.id);
  if (!object) throw new Error('Missing image reference');
  if (['image', 'svg', 'prop'].includes(object.type)) {
    const src = object.doodle ? doodleSource(object.doodle, object.width, Math.max(1, object.height - 34)) : object.src;
    if (src && /^(?:data:image\/|https?:\/\/)/i.test(src)) return src;
  }
  if (object.type === 'mermaid') return (await renderMermaid(object.mermaidSource ?? '')).src;
  if (object.type === 'qrcode' || (object.type === 'link' && !object.deskPath && object.linkDisplay === 'qr')) {
    return (await renderQrCode(object.qrText ?? object.url ?? '', getUiLanguage())).src;
  }
  throw new Error('Object cannot render as an image');
}

export function markdownImageUnavailable(container: HTMLElement) {
  container.dataset.imageStatus = 'error';
  container.textContent = `▧ ${t('editing:imageUnavailable')}${container.dataset.imageAlt ? ` — ${container.dataset.imageAlt}` : ''}`;
}

export function hydrateMarkdownImages(container: HTMLElement) {
  for (const host of container.querySelectorAll<HTMLElement>('[data-markdown-image]')) {
    host.dataset.imageStatus = 'loading';
    host.textContent = `▧ ${host.dataset.imageAlt ?? ''}`;
    void resolveSource(host.dataset.markdownImage ?? '').then(src => new Promise<void>((resolve, reject) => {
      const image = new Image(); image.alt = host.dataset.imageAlt ?? ''; image.referrerPolicy = 'no-referrer'; image.draggable = false;
      const timer = setTimeout(() => { image.src = ''; reject(new Error('Image load timed out')); }, 15000);
      image.onload = () => { clearTimeout(timer); host.replaceChildren(image); host.dataset.imageStatus = 'ready'; resolve(); };
      image.onerror = () => { clearTimeout(timer); reject(new Error('Image load failed')); };
      image.src = src;
    })).catch(() => markdownImageUnavailable(host));
  }
}
