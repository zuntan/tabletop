import type {DeskObject} from './model';
import {element as svg} from './diagram-drawing';
import {rulerVertical} from './ruler-layout';

/** One repeating SVG pattern; element count does not grow with ruler length. */
export function drawRuler(group:SVGGElement,r:DeskObject){
 const vertical=rulerVertical(r),length=vertical?r.height:r.width,thickness=vertical?r.width:r.height;
 const material=r.rulerMaterial??'acrylic';
 const colors=material==='bamboo'?{fill:'#e7c88f',stroke:'#8b693b',ink:'#78562f',opacity:.94}:material==='steel'?{fill:'#c8d0d6',stroke:'#687783',ink:'#52616e',opacity:1}:{fill:'#d9f1f3',stroke:'#70949e',ink:'#527782',opacity:.28};
 const id='ruler-ticks-'+Array.from(r.id,c=>c.codePointAt(0)!.toString(16)).join('-'),gradient=id+'-metal';
 const body=svg('g',{'data-ruler-body':'',...(vertical?{transform:`translate(${r.width} 0) rotate(90)`}:{})});
 const defs=svg('defs'),pattern=svg('pattern',{id,patternUnits:'userSpaceOnUse',width:80,height:thickness});
 let ticks='';for(let x=0;x<80;x+=8){const h=x===0?thickness*.4:x===40?thickness*.3:thickness*.18;ticks+=`M ${x} 1 v ${h} M ${x} ${thickness-1} v ${-h} `;}
 pattern.append(svg('path',{d:ticks,fill:'none',stroke:colors.ink,'stroke-width':.8,opacity:.75}));defs.append(pattern);
 if(material==='steel'){const g=svg('linearGradient',{id:gradient,x1:'0%',y1:'0%',x2:'0%',y2:'100%'});for(const [offset,color]of [['0%','#e0e5e9'],['42%','#bcc6ce'],['65%','#e9edf0'],['100%','#aebbc5']])g.append(svg('stop',{offset,'stop-color':color}));defs.append(g);}
 body.append(defs,svg('rect',{width:length,height:thickness,rx:2,fill:material==='steel'?`url(#${gradient})`:colors.fill,'fill-opacity':colors.opacity,stroke:colors.stroke,'stroke-width':1.2}),svg('rect',{x:1,y:1,width:Math.max(0,length-2),height:Math.max(0,thickness-2),fill:`url(#${id})`,'pointer-events':'none'}));
 const title=svg('title');title.textContent=`定規：${{free:'自由',gap:'均等',center:'中心均等'}[r.rulerMode??'free']}・${{acrylic:'アクリル',bamboo:'竹',steel:'ステンレス'}[material]}・${r.rulerMembers?.length??0}枚`;body.append(title);group.append(body);
}
