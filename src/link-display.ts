import type {DeskObject} from './model';
import {element} from './diagram-drawing';
import {drawQrCard} from './qr-card';
import {IMAGE_TITLE_HEIGHT} from './image-geometry';

export {isUrlLink} from './link-values';
export function chainIcon(size:number,color:string){
  const icon=element('svg',{width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:color,'stroke-width':1.75,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'});
  for(const d of ['M9 15l6 -6','M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464','M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463'])icon.append(element('path',{d}));
  return icon;
}
export function drawLinkDisplay(group:SVGGElement,object:DeskObject,zoom=1){
  const header=chainIcon(18,'#1d4ed8');header.setAttribute('x','10');header.setAttribute('y','8');header.setAttribute('data-link-header-icon','');group.append(header);
  group.dataset.linkDisplay=object.linkDisplay??'url';
  if(object.linkDisplay==='qr'){drawQrCard(group,{...object,qrText:object.url??''},zoom);return;}
  if(object.height<=IMAGE_TITLE_HEIGHT)return;
  const content=element('foreignObject',{x:0,y:IMAGE_TITLE_HEIGHT,width:object.width,height:object.height-IMAGE_TITLE_HEIGHT,'pointer-events':'none','data-link-url-content':''});
  const box=document.createElementNS('http://www.w3.org/1999/xhtml','div');
  const height=object.height-IMAGE_TITLE_HEIGHT,padding=Math.max(0,Math.min(12,(height-object.fontSize*1.25)/2));
  Object.assign(box.style,{boxSizing:'border-box',width:'100%',height:'100%',padding:`${padding}px 12px`,display:'flex',alignItems:'center',gap:'.35em',overflow:'hidden',fontFamily:'sans-serif',fontSize:`${object.fontSize}px`,lineHeight:'1.25',color:object.textColor,textAlign:'left'});
  const icon=chainIcon(object.fontSize,object.textColor);icon.setAttribute('data-link-body-icon','');icon.style.flex='none';box.append(icon);
  const text=document.createElementNS('http://www.w3.org/1999/xhtml','span');text.textContent=object.url??'';
  Object.assign(text.style,{minWidth:'0',flex:'1',overflowWrap:'anywhere',whiteSpace:'pre-wrap'});text.setAttribute('data-link-url-text','');box.append(text);
  content.append(box);group.append(content);
}
