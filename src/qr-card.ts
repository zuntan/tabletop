import { getUiLanguage, languageChangeEvent, t } from './i18n';
import {stickerItems} from './sticker-values';
import type {DeskObject} from './model';
import {element} from './diagram-drawing';
import {IMAGE_TITLE_HEIGHT} from './image-geometry';
import {renderQrCode} from './qr-code';

export function qrCardLayout(object:DeskObject,zoom=1){
  const available=Math.max(0,object.height-IMAGE_TITLE_HEIGHT);
  const margin=(object.stickers&&stickerItems(object.stickers).length)?object.stickers.diameter/(object.stickers.fixed?zoom:1):0;
  const inset=Math.min(margin,available/2);
  return {y:IMAGE_TITLE_HEIGHT+inset,height:Math.max(0,available-2*inset)};
}
export function updateQrCardLayout(group:SVGGElement,object:DeskObject,zoom=1){
  const image=group.querySelector(':scope > .qr-image');if(!image)return;
  const layout=qrCardLayout(object,zoom);image.setAttribute('y',String(layout.y));image.setAttribute('height',String(layout.height));
}
const redraw = new WeakMap<SVGGElement, () => void>();
if (typeof document !== 'undefined') document.addEventListener(languageChangeEvent, () => {
  for (const group of document.querySelectorAll<SVGGElement>('[data-qr-status]')) redraw.get(group)?.();
});

export function drawQrCard(group:SVGGElement,object:DeskObject,zoom=1){
  const layout=qrCardLayout(object,zoom);
  const image=element('image',{y:layout.y,width:object.width,height:layout.height,preserveAspectRatio:'xMidYMid meet','pointer-events':'none',class:'qr-image'});
  group.append(image);
  let generation=0;
  const refresh=()=>{
    const ticket=++generation;
    group.dataset.qrStatus='loading';group.querySelector('.qr-error')?.remove();
    void renderQrCode(object.qrText??'',getUiLanguage()).then(result=>{
      if(ticket!==generation)return;
      image.setAttribute('href',result.src);group.dataset.qrStatus=result.status;
    }).catch(()=>{
      if(ticket!==generation)return;
      group.dataset.qrStatus='error';
      const text=element('text',{x:12,y:IMAGE_TITLE_HEIGHT+24,'font-size':14,fill:'#b91c1c','pointer-events':'none',class:'qr-error'});
      text.textContent=t('creation:qrFailed');group.append(text);
    });
  };
  redraw.set(group,refresh);refresh();
}
