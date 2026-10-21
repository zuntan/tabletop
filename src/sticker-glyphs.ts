import type { StickerShape } from './sticker-shapes';
import svg0 from './assets/stickers/circle.svg?raw';
import svg1 from './assets/stickers/star.svg?raw';
import svg2 from './assets/stickers/triangle.svg?raw';
import svg3 from './assets/stickers/square-rotated.svg?raw';
import svg4 from './assets/stickers/alert-square-rounded.svg?raw';
import svg5 from './assets/stickers/heart.svg?raw';
import svg6 from './assets/stickers/seedling.svg?raw';
import svg7 from './assets/stickers/michelin-star.svg?raw';
import svg8 from './assets/stickers/award.svg?raw';
import svg9 from './assets/stickers/trophy.svg?raw';
import svg10 from './assets/stickers/mood-smile.svg?raw';
import svg11 from './assets/stickers/paw.svg?raw';
import svg12 from './assets/stickers/pig.svg?raw';
import svg13 from './assets/stickers/mickey.svg?raw';
import svg14 from './assets/stickers/ghost.svg?raw';
const sources: Record<StickerShape,string> = {'circle':svg0,'star':svg1,'triangle':svg2,'diamond':svg3,'alert-square-rounded':svg4,'heart':svg5,'seedling':svg6,'michelin-star':svg7,'award':svg8,'trophy':svg9,'mood-smile':svg10,'paw':svg11,'pig':svg12,'mickey':svg13,'ghost':svg14};
const bounds = new Map<StickerShape,string>();
/** Use the actual SVG outline bounds, sharing one glyph in the palette, swatch and desk. */
export function stickerGlyph(shape:StickerShape, color='currentColor'):SVGSVGElement {
  const svg=new DOMParser().parseFromString(sources[shape],'image/svg+xml').documentElement as unknown as SVGSVGElement;
  svg.removeAttribute('width');svg.removeAttribute('height');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
  svg.style.color=color;svg.setAttribute('fill',color);svg.dataset.stickerShape=shape;
  if(!bounds.has(shape)){
    const measure=document.createElementNS('http://www.w3.org/2000/svg','svg');
    measure.style.cssText='position:fixed;left:-10000px;top:-10000px;visibility:hidden;width:24px;height:24px;pointer-events:none';
    const group=document.createElementNS(measure.namespaceURI,'g');
    for(const child of Array.from(svg.children)) group.append(child.cloneNode(true));
    measure.append(group);document.body.append(measure);
    try {const box=(group as SVGGElement).getBBox();if(box.width&&box.height)bounds.set(shape,`${box.x} ${box.y} ${box.width} ${box.height}`);}
    finally {measure.remove();}
  }
  svg.setAttribute('viewBox',bounds.get(shape)??'0 0 24 24');
  svg.setAttribute('preserveAspectRatio','xMidYMid meet');
  return svg;
}
