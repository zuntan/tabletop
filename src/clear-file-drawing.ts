import type {DeskObject} from './model';
import {element as svg} from './diagram-drawing';
import {FILE_TITLE} from './clear-files';
export function drawClearFile(group:SVGGElement,object:DeskObject){
 const w=object.width,h=object.height;
 group.append(svg('rect',{width:w,height:h,rx:8,fill:object.fill,'fill-opacity':object.fillOpacity,stroke:object.stroke,'stroke-width':object.strokeWidth,'data-file-body':'','pointer-events':'all'}));
 group.append(svg('rect',{x:6,y:6,width:Math.max(1,w-12),height:Math.max(1,h-12),rx:4,fill:'none',stroke:object.stroke,'stroke-width':Math.max(.5,object.strokeWidth*.6),'pointer-events':'none','data-file-inner':''}));
 group.append(svg('path',{d:`M 6 ${FILE_TITLE} H ${w-6}`,stroke:object.stroke,'stroke-width':object.strokeWidth,'pointer-events':'none'}));
 const title=svg('text',{x:14,y:FILE_TITLE/2,'dominant-baseline':'middle','font-size':object.fontSize,'font-family':'sans-serif',fill:object.textColor,'pointer-events':'none','data-file-title':''});
 title.textContent=object.text||'クリアファイル';if(title.textContent.length*object.fontSize>w-28){title.setAttribute('textLength',String(Math.max(1,w-28)));title.setAttribute('lengthAdjust','spacingAndGlyphs');}group.append(title);
}
