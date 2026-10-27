/** Human creation sizes based on the user's selected desk samples (2026-10-22). */
export const initialPartContent = { width:368, height:192 };
export const initialTextSize = {width:744,height:480};
export const initialLineDelta = {x:300,y:168};
export function initialPartSize(type:string) {
  const {width,height}=initialPartContent;
  if(type==='wayfinder')return {width:72,height:72};
  if(type==='text')return {...initialTextSize};
  if(type==='link')return {width,height:60};
  if(['image','svg','mermaid','web'].includes(type))return {width,height:height+34};
  if(['rect','roundedRect','ellipse','diamond','parallelogram','cylinder','document','cloud'].includes(type))return {width,height};
  return {};
}
export function initialLinePoints(center:{x:number;y:number}) {
  return {x:center.x-initialLineDelta.x/2,y:center.y-initialLineDelta.y/2,
    x2:center.x+initialLineDelta.x/2,y2:center.y+initialLineDelta.y/2};
}
export function initialImageSize(width:number,height:number) {
  const ratio=Math.min(initialPartContent.width/Math.max(1,width),initialPartContent.height/Math.max(1,height));
  return {width:Math.max(1,width*ratio),height:Math.max(1,height*ratio)+34};
}
export function centeredPartPoint(camera:{x:number;y:number;zoom:number},viewport:{width:number;height:number},size:{width:number;height:number},offset=0) {
  return {x:(viewport.width/2-camera.x)/camera.zoom-size.width/2+offset,
    y:(viewport.height/2-camera.y)/camera.zoom-size.height/2+offset};
}
