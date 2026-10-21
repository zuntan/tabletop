import type { DeskObject } from './model';
import { element as svg } from './diagram-drawing';
import { bodyRect, cutoutTitle, cutoutSourceObject } from './logical-cutout';

let sequence=0;
/** Reuse the ordinary renderer, then place its content inside a self-contained local clip. */
export function drawCutout(group:SVGGElement,object:DeskObject,ordinary:(source:DeskObject)=>SVGGElement){
 const c=object.cutout!,title=cutoutTitle(object),bodyHeight=object.height-title;
 const source=ordinary(cutoutSourceObject(object));
 source.removeAttribute('transform');source.removeAttribute('data-id');source.dataset.cutoutSource=object.id;
 if(title){
  // The first text is the ordinary title. Open controls remain on the outside card.
  [...source.children].find(node=>node.tagName==='text')?.remove();
  source.querySelectorAll('.open-link').forEach(node=>node.remove());
  source.setAttribute('transform',`translate(0 ${-title})`);
  group.append(svg('rect',{width:object.width,height:object.height,rx:6,fill:'none',stroke:'#94a3b8'}),
    svg('rect',{width:object.width,height:title,rx:6,fill:'#fff',stroke:'#94a3b8'}));
  const heading=svg('text',{x:12,y:23,'font-size':14,fill:'#1d4ed8'});
  heading.textContent=(object.text||object.url||'').slice(0,Math.max(0,Math.floor((object.width-52)/8)));group.append(heading);
 }
 // Full rectangular hit target is deliberate, including an entirely empty result.
 group.append(svg('rect',{width:object.width,height:object.height,fill:'transparent',stroke:'none','pointer-events':'all','data-cutout-hit':''}));
 const content=svg('g',{'data-cutout-content':'',transform:`translate(0 ${title})`});
 const window=svg('g');
 {
  const id=`cutout-${++sequence}`;
  const clip=svg('clipPath',{id,clipPathUnits:'userSpaceOnUse'});
  clip.append(c.enabled?svg('path',{d:c.path,transform:`scale(${object.width} ${bodyHeight})`}):svg('rect',{width:object.width,height:bodyHeight}));
  const defs=svg('defs');defs.append(clip);group.append(defs);
  window.setAttribute('clip-path',`url(#${id})`);
 }
 const b=bodyRect(object),original=c.enabled?{x:c.source.x*b.width,y:c.source.y*b.height,width:c.source.width*b.width,height:c.source.height*b.height}
  :{x:0,y:0,width:b.width,height:b.height};
 const placement=svg('g',{transform:`translate(${original.x} ${original.y}) scale(${original.width/c.layout.width} ${original.height/c.layout.height})`});
 placement.append(source);window.append(placement);content.append(window);group.append(content);
}
