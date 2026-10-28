import deskArtwork from './assets/desk-link.svg?raw';
import { openMedia } from './media-viewer';
import type { DeskObject } from './model';
import { element } from './diagram-drawing';

/** Decorative SVG remains part of the card, including raster/PDF exports. */
export function drawDeskLinkIcon(group:SVGGElement, object:DeskObject){
  const icon=element('svg',{x:10,y:6,width:24,height:24,viewBox:'0 0 24 24','aria-hidden':'true','pointer-events':'none','data-desk-link-icon':''});
  icon.append(element('path',{d:'M3 10h18v4H3z M5 14v7 M19 14v7 M7 3h10v7 M9 6h6',fill:'none',stroke:'#1d4ed8','stroke-width':1.5,'stroke-linecap':'round','stroke-linejoin':'round'}));
  group.append(icon);
  if(object.height>48){
    group.append(element('image',{x:12,y:38,width:Math.max(1,object.width-24),height:object.height-46,
      href:`data:image/svg+xml;base64,${btoa(deskArtwork)}`,preserveAspectRatio:'xMidYMid meet','pointer-events':'none','data-desk-link-artwork':''}));
  }
}

export function drawOpenLink(group: SVGGElement, object: DeskObject, openDesk?:(path:string)=>void) {
  if(object.deskPath){
    const control=element('g',{'data-open-desk':object.id,role:'button',tabindex:0,'aria-label':`机を開く：${object.text||object.deskPath}`,class:'open-link'});
    const x=Math.max(0,object.width-36);
    control.append(element('rect',{x,y:5,width:28,height:24,rx:4,fill:'#fff',stroke:'#cbd5e1'}));
    control.append(element('path',{d:`M ${x+6} 12 h16 v9 h-16 Z M ${x+6} 21 v4 M ${x+22} 21 v4 M ${x+9} 9 h10` ,fill:'none',stroke:'#1d4ed8','stroke-width':1.5,'stroke-linecap':'round','stroke-linejoin':'round'}));
    const title=element('title');title.textContent=object.deskPath;control.append(title);
    control.addEventListener('click',event=>{event.stopPropagation();openDesk?.(object.deskPath!);});
    control.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();openDesk?.(object.deskPath!);}});
    group.append(control);return;
  }
  const media = ['image', 'svg', 'mermaid', 'qrcode'].includes(object.type);
  if (object.url && ['link', 'web', 'image', 'svg'].includes(object.type)) drawControl(group, object, false, 0);
  if (media) drawControl(group, object, true, object.url ? 32 : 0);
}
function drawControl(group: SVGGElement, object: DeskObject, media: boolean, offset: number) {
  const width = Math.min(28, object.width), height = Math.min(24, object.height);
  const x = Math.max(0, object.width - width - 6 - offset), y = Math.max(0, Math.min(5, object.height - height));
  const label = `${media ? '画像を別タブで開く' : '別タブで開く'}：${object.text || object.url || object.type}`;
  const link = element('a', { href: media ? 'about:blank' : object.url!, target: '_blank', rel: 'noopener noreferrer',
    tabindex: 0, 'aria-label': label, [media ? 'data-open-media' : 'data-open-url']: object.id, class: 'open-link' });
  if (media) {
    link.setAttribute('data-open-media', object.id);
    link.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); openMedia(object); });
    link.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); openMedia(object); }
    });
  }
  const title = element('title'); title.textContent = label; link.append(title);
  link.append(element('rect', { x, y, width, height, rx: 4, fill: '#ffffff', stroke: '#cbd5e1', 'stroke-width': 1 }));
  const icon = element('text', { x: x + width / 2, y: y + height / 2, 'font-size': Math.min(18, height),
    fill: '#1d4ed8', 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'pointer-events': 'none' });
  icon.textContent = '↗'; link.append(icon);
  group.append(link);
}
