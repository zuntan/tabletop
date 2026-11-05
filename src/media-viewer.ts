import { uiErrorMessage } from './i18n/errors';
import { getUiLanguage, uiI18n } from './i18n';
import {renderQrCode} from './qr-code';
import type { DeskObject } from './model';
import { renderMermaid } from './mermaid-card';

/** Open synchronously on a human gesture; all SVG stays in an inert image context. */
export function openMedia(object: DeskObject) {
  const popup = window.open('about:blank', '_blank');
  if (!popup) return;
  popup.opener = null;
  const language=getUiLanguage();
  const text=uiI18n.getFixedT(language,'creation');
  const doc = popup.document;
  doc.title = object.text || (object.type === 'mermaid' ? 'Mermaid' : text('image'));
  doc.documentElement.lang = language;
  const style = doc.createElement('style');
  style.textContent = 'html,body{margin:0;min-height:100%;background:#f8fafc;color:#334155;font-family:sans-serif}body{display:flex;align-items:center;justify-content:center;min-height:100vh}img{display:block;max-width:100%;max-height:100vh;object-fit:contain}p{padding:24px}';
  doc.head.append(style);
  const message = doc.createElement('p'); message.textContent = text('preparingImage'); doc.body.append(message);
  const show = (src: string) => {
    if (popup.closed) return;
    const image = doc.createElement('img'); image.alt = object.text || text('image'); image.referrerPolicy = 'no-referrer';
    image.onload = () => message.remove(); image.onerror = () => { message.textContent = text('imageFailed'); };
    doc.body.append(image); image.src = src;
  };
  if(object.type==='qrcode'){
    void renderQrCode(object.qrText??'',language).then(result=>show(result.src)).catch(()=>{if(!popup.closed)message.textContent=text('qrDisplayFailed');});
  }else if (object.type === 'mermaid') {
    void renderMermaid(object.mermaidSource ?? '').then(result => show(result.src)).catch(error => {
      if (!popup.closed) message.textContent = text('diagramDisplayFailed',{error:uiErrorMessage(error, language)});
    });
  } else if (object.src) show(object.src);
  else message.textContent = text('noImage');
}
