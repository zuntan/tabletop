import type { DeskObject } from './model';
import { renderMermaid } from './mermaid-card';

/** Open synchronously on a human gesture; all SVG stays in an inert image context. */
export function openMedia(object: DeskObject) {
  const popup = window.open('about:blank', '_blank');
  if (!popup) return;
  popup.opener = null;
  const doc = popup.document;
  doc.title = object.text || (object.type === 'mermaid' ? 'Mermaid' : '画像');
  doc.documentElement.lang = 'ja';
  const style = doc.createElement('style');
  style.textContent = 'html,body{margin:0;min-height:100%;background:#f8fafc;color:#334155;font-family:sans-serif}body{display:flex;align-items:center;justify-content:center;min-height:100vh}img{display:block;max-width:100%;max-height:100vh;object-fit:contain}p{padding:24px}';
  doc.head.append(style);
  const message = doc.createElement('p'); message.textContent = '画像を準備中…'; doc.body.append(message);
  const show = (src: string) => {
    if (popup.closed) return;
    const image = doc.createElement('img'); image.alt = object.text || '画像'; image.referrerPolicy = 'no-referrer';
    image.onload = () => message.remove(); image.onerror = () => { message.textContent = '画像を表示できませんでした。'; };
    doc.body.append(image); image.src = src;
  };
  if (object.type === 'mermaid') {
    void renderMermaid(object.mermaidSource ?? '').then(result => show(result.src)).catch(error => {
      if (!popup.closed) message.textContent = `図を表示できませんでした：${error instanceof Error ? error.message : String(error)}`;
    });
  } else if (object.src) show(object.src);
  else message.textContent = '画像がありません。';
}
