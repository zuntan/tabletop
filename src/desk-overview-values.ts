export type OverviewRect={x:number;y:number;width:number;height:number};
export function overviewUnion(rects:readonly OverviewRect[]):OverviewRect|null{
  if(!rects.length)return null;
  let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;
  for(const rect of rects){x=Math.min(x,rect.x);y=Math.min(y,rect.y);right=Math.max(right,rect.x+rect.width);bottom=Math.max(bottom,rect.y+rect.height);}
  return {x,y,width:right-x,height:bottom-y};
}
/** Compare the same unprojected rectangles used by the minimap. */
export function offscreenDirections(all:OverviewRect|null,view:OverviewRect):string{
  if(!all)return '';
  return [all.x<view.x?'←':'',all.y<view.y?'↑':'',
    all.x+all.width>view.x+view.width?'→':'',all.y+all.height>view.y+view.height?'↓':''].filter(Boolean).join(' ');
}
/** Fit the union of both rectangles, rather than assuming either contains the other. */
export function overviewLayout(all:OverviewRect|null,view:OverviewRect,width=164,height=112){
  const union=overviewUnion(all?[all,view]:[view])!;
  const scale=Math.min((width-12)/Math.max(1,union.width),(height-12)/Math.max(1,union.height));
  const offsetX=(width-union.width*scale)/2,offsetY=(height-union.height*scale)/2;
  const project=(rect:OverviewRect)=>({x:offsetX+(rect.x-union.x)*scale,y:offsetY+(rect.y-union.y)*scale,width:Math.max(.5,rect.width*scale),height:Math.max(.5,rect.height*scale)});
  return {all:all?project(all):null,view:project(view)};
}
