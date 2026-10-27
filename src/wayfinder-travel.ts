import type { Camera, CameraSize } from './camera-control';
import type { Point } from './geometry';
import { measuredRoute } from './wayfinder-route';

export function travelDuration(worldLength:number,zoom:number){return Math.min(5000,Math.max(800,650+650*Math.log2(1+worldLength*zoom/500)));}
export type WayfinderMode='move'|'tour';
export type WayfinderStopReason='human'|'changed'|'hidden'|'superseded'|'timeout';
export class WayfinderCancelled extends Error{
  constructor(readonly reason:WayfinderStopReason){super('Wayfinder cancelled');}
}
export const tourSpeed=120; // CSS pixels per second, independent of zoom and route segmentation.
export function wayfinderDuration(worldLength:number,zoom:number,mode:WayfinderMode){
  return mode==='tour'?Math.max(1,worldLength*zoom/tourSpeed*1000):travelDuration(worldLength,zoom);
}
export function wayfinderProgress(progress:number,mode:WayfinderMode){
  const t=Math.max(0,Math.min(1,progress));return mode==='tour'?t:t*t*(3-2*t);
}

/** Browser-only camera presentation; never edits the desk or its Undo history. */
export class WayfinderTravel {
  private stop?:(reason:WayfinderStopReason)=>void;
  cancel(reason:WayfinderStopReason='human'){this.stop?.(reason);}
  async run(points:Point[],camera:Camera,size:()=>CameraSize,valid:()=>boolean,
    apply:(camera:Camera,marker:Point|null)=>void,reducedMotion=false,mode:WayfinderMode='move'){
    this.cancel('superseded');
    const zoom=camera.zoom,dimensions=size(),center={x:(dimensions.width/2-camera.x)/zoom,y:(dimensions.height/2-camera.y)/zoom};
    const route=measuredRoute(points), approach=measuredRoute([center,points[0]]);
    const centered=(p:Point):Camera=>({x:dimensions.width/2-p.x*zoom,y:dimensions.height/2-p.y*zoom,zoom});
    if(reducedMotion){apply(centered(points.at(-1)!),null);return;}
    const lead=Math.min(600,Math.max(180,approach.length*zoom*.2)),duration=wayfinderDuration(route.length,zoom,mode);
    await new Promise<void>((resolve,reject)=>{
      let frame:number|undefined,start:number|undefined,marker:Point|null=null;
      const cleanup=()=>{if(frame!==undefined)cancelAnimationFrame(frame);clearTimeout(deadline);this.stop=undefined;apply({...camera},null);};
      this.stop=reason=>{cleanup();reject(new WayfinderCancelled(reason));};
      const deadline=setTimeout(()=>this.cancel('timeout'),Math.min(2_147_000_000,lead+duration+1200));
      const tick=(timestamp:number)=>{
        if(!valid()){this.cancel('changed');return;}if(document.hidden){this.cancel('hidden');return;}
        start??=timestamp;const elapsed=timestamp-start;
        const progress=Math.min(1,Math.max(0,(elapsed-lead)/duration)),ease=(t:number)=>t*t*(3-2*t);
        const p=elapsed<lead?approach.at(ease(elapsed/lead)):route.at(wayfinderProgress(progress,mode));
        marker=elapsed<lead?null:p;
        try{Object.assign(camera,centered(p));apply({...camera},marker);}catch(error){cleanup();reject(error);return;}
        if(elapsed>=lead+duration){cleanup();resolve();}else frame=requestAnimationFrame(tick);
      };
      frame=requestAnimationFrame(tick);
    });
  }
}
