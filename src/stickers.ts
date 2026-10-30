import { stickerGlyph } from './sticker-glyphs';
import type { DeskObject } from './model';
import { element } from './diagram-drawing';
import { stickerPoints, stickerItems } from './sticker-values';
export function drawStickers(group: SVGGElement, object: DeskObject, zoom = 1) {
  group.querySelector(':scope > [data-stickers]')?.remove();
  const stickers = object.stickers;
  if ((!stickers || !stickerItems(stickers).length)) return;
  const layer = element('g', { 'data-stickers': object.id, 'pointer-events': 'none', 'aria-hidden': 'true' });
  for(const point of stickerPoints(object.width,object.height,stickers,zoom)) {
    const glyph=stickerGlyph(point.shape,point.color);
    glyph.setAttribute('x',String(point.x-point.diameter/2));glyph.setAttribute('y',String(point.y-point.diameter/2));
    glyph.setAttribute('width',String(point.diameter));glyph.setAttribute('height',String(point.diameter));
    layer.append(glyph);
  }
  group.append(layer);
}
