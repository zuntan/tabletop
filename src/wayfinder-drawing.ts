import type { DeskObject } from './model';
import { element } from './diagram-drawing';

export function wayfinderDirection(scene:DeskObject[],id:string):'top'|'left'|'right'{
  for(const line of scene)if(line.type==='line')for(const binding of [line.startBinding,line.endBinding])
    if(binding?.objectId===id&&['top','left','right'].includes(binding.anchor))return binding.anchor as 'top'|'left'|'right';
  return 'right';
}

/** Temporary signpost artwork. The small launch face is separate from the drag body. */
export function drawWayfinder(group:SVGGElement,object:DeskObject,start:()=>void,scene:DeskObject[]=[]){
  const w=object.width,h=object.height;
  const direction=wayfinderDirection(scene,object.id);
  group.append(element('path',{d:`M ${w*.42} ${h*.45} H ${w*.58} V ${h*.82} L ${w*.5} ${h} L ${w*.42} ${h*.82} Z`,fill:'#b8a58b',stroke:object.stroke,'stroke-width':1.5}));
  const board=direction==='top'?`M 1 ${h*.56} V ${h*.24} L ${w*.5} 1 L ${w-1} ${h*.24} V ${h*.56} Z`:
    `M 1 ${h*.08} H ${w*.76} L ${w-1} ${h*.32} L ${w*.76} ${h*.56} H 1 Z`;
  group.append(element('path',{d:board,...(direction==='left'?{transform:`translate(${w} 0) scale(-1 1)`}:{}),fill:object.fill,'fill-opacity':object.fillOpacity,stroke:object.stroke,'stroke-width':1.5}));
  const launch=element('g',{'data-wayfinder-run':object.id,role:'button',tabindex:0,'aria-label':'道しるべをたどる',style:'cursor:pointer'});
  const title=element('title');title.textContent=(object.wayfinderMode==='tour'?'観光：ゆっくり等速でたどる':'移動：加減速してたどる')+'（看板の余白で選択・移動）';launch.append(title);
  const cx=w*.5,cy=h*.32,r=Math.min(w*.18,h*.18),angle=direction==='left'?180:direction==='top'?-90:0;
  launch.setAttribute('data-wayfinder-direction',direction);
  launch.append(element('circle',{cx,cy,r,fill:'#ffffff','fill-opacity':.8}));
  launch.append(element('path',{d:`M ${cx-r*.35} ${cy-r*.55} L ${cx+r*.5} ${cy} L ${cx-r*.35} ${cy+r*.55} Z`,transform:`rotate(${angle} ${cx} ${cy})`,fill:'#166534','pointer-events':'none'}));
  launch.addEventListener('pointerdown',event=>event.stopPropagation());
  launch.addEventListener('dblclick',event=>event.stopPropagation());
  launch.addEventListener('click',event=>{event.stopPropagation();start();});
  launch.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Enter'||event.key===' '){event.preventDefault();start();}});
  group.append(launch);
}
