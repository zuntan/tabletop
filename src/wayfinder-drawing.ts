import type { DeskObject } from './model';
import { element } from './diagram-drawing';
export type WayfinderDirection='top'|'right'|'bottom'|'left';
export function wayfinderDirection(scene:DeskObject[],id:string):WayfinderDirection{
 for(const line of scene)if(line.type==='line')for(const binding of [line.startBinding,line.endBinding])
  if(binding?.objectId===id&&['top','right','bottom','left'].includes(binding.anchor))return binding.anchor as WayfinderDirection;
 return 'right';
}

/** Artwork stays zoom-dependent; the screen-sized launch control is separate selection UI. */
export function drawWayfinder(group:SVGGElement,object:DeskObject,scene:DeskObject[]=[]){
 const w=object.width,h=object.height,direction=wayfinderDirection(scene,object.id);
 group.append(element('path',{d:`M ${w*.42} ${h*.45} H ${w*.58} V ${h*.82} L ${w*.5} ${h} L ${w*.42} ${h*.82} Z`,fill:'#b8a58b',stroke:object.stroke,'stroke-width':1.5}));
 const board=direction==='top'?`M 1 ${h*.56} V ${h*.24} L ${w*.5} 1 L ${w-1} ${h*.24} V ${h*.56} Z`:
  direction==='bottom'?`M 1 ${h*.08} H ${w-1} V ${h*.4} L ${w*.5} ${h*.64} L 1 ${h*.4} Z`:
  `M 1 ${h*.08} H ${w*.76} L ${w-1} ${h*.32} L ${w*.76} ${h*.56} H 1 Z`;
 group.append(element('path',{d:board,...(direction==='left'?{transform:`translate(${w} 0) scale(-1 1)`}:{}),fill:object.fill,'fill-opacity':object.fillOpacity,stroke:object.stroke,'stroke-width':1.5,'data-wayfinder-board':direction}));
 // Keep the directional mark, without embedding an interactive button in the artwork.
 const cx=w*.5,cy=h*.32,r=Math.min(w*.18,h*.18),angle=direction==='left'?180:direction==='top'?-90:direction==='bottom'?90:0;
 group.append(element('path',{d:`M ${cx-r*.35} ${cy-r*.55} L ${cx+r*.5} ${cy} L ${cx-r*.35} ${cy+r*.55} Z`,transform:`rotate(${angle} ${cx} ${cy})`,fill:object.textColor,'pointer-events':'none','data-wayfinder-direction':direction}));
}
