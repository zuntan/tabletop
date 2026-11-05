import {element} from './diagram-drawing';

/** Coordinates are in the complete stamp's canonical space, outside artwork scaling. */
export function stampDateLayout(id:string) {
 const base={size:8,weight:600 as 400|600,y:27,maxWidth:50,mode:'inside' as 'inside'|'footer'};
 if(['hanamaru_ja','smile_ja','keep_going_ja','well_done_ja'].includes(id))
  return {...base,size:9,y:49,maxWidth:64,mode:'footer' as const};
 if(['done_en','rejected_en','sealed_en','on_hold_en'].includes(id))
  return {...base,size:11,y:27,maxWidth:152};
 if(['confidential_en','copy_paste_only_en','wanted_en'].includes(id))
  return {...base,size:id.endsWith('_en')?11:9.5,y:id==='copy_paste_only_en'?26:24.75,maxWidth:152};
 if(['caution_en','danger_en','do_not_remove_ja'].includes(id))
  return {...base,size:12.3,y:32.2,maxWidth:152};
 if(id==='excellent_en')return {...base,size:12.3,y:64,maxWidth:152,mode:'footer' as const};
 if(['unread_en','read_en','good_en','bad_en'].includes(id))
  return {...base,size:8,y:33.5,maxWidth:64};
 if(['copy_paste_only_ja','wanted_ja','shirangana_ja'].includes(id))
  return {...base,size:8.5,weight:400 as const,y:33.5,maxWidth:64};
 if(['handle_with_care_ja','handle_with_care_en'].includes(id))
  return {...base,size:7.5,y:35,maxWidth:58};
 if(id==='nandeyanen_ja')return {...base,size:7.5,weight:400 as const,y:29,maxWidth:48};
 return base;
}

export function appendStampDate(parent:SVGGElement,id:string,value:string,opacity=1) {
 if(!value)return;
 const layout=stampDateLayout(id);
 const label=element('text',{x:0,y:layout.y,'data-stamp-date':layout.mode,
  'text-anchor':'middle','dominant-baseline':'middle','font-size':layout.size,
  'font-family':'monospace','font-weight':layout.weight,fill:'#c93428',stroke:'none',opacity});
 label.textContent=value;
 const estimatedWidth=[...value].reduce((sum,char)=>sum+(char.codePointAt(0)!>255?1.1:.65),0)*layout.size;
 if(estimatedWidth>layout.maxWidth){label.setAttribute('textLength',String(layout.maxWidth));label.setAttribute('lengthAdjust','spacingAndGlyphs');}
 parent.append(label);
}
