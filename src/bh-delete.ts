import type { Desk, DeskObject } from './model';
import { rasterRenderedPart } from './part-raster';
import { bhFrames, BH_DURATION, type BhMode } from './bh-animation';
import './bh-delete.css';

type View = { x: number; y: number; zoom: number };
/** Presentation is disposable. The actual deletion is one ordinary, already committed batch. */
export class BhDeletion {
  private epoch=0;
  private raf=0;
  private overlay?: HTMLCanvasElement;
  private preparing=false;
  stop() { this.epoch++;cancelAnimationFrame(this.raf);this.overlay?.remove();this.overlay=undefined;this.preparing=false; }
  async run(desk: Desk, ids: string[], mode: BhMode, node: (id:string)=>SVGGElement|undefined,
    canvas: SVGSVGElement, view:()=>View, commit:()=>void, render:()=>void) {
    if(this.preparing) return;
    this.stop();if(!ids.length)return;
    const epoch=this.epoch,revision=desk.revision,session=desk.sessionId,camera={...view()};
    const rect=canvas.getBoundingClientRect();
    const valid=()=>this.epoch===epoch&&desk.sessionId===session&&desk.revision===revision&&
      view().x===camera.x&&view().y===camera.y&&view().zoom===camera.zoom;
    const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||document.hidden;
    // No capture/animation needed when motion is disabled or the tab is hidden.
    if(reduced()){commit();render();return;}
    this.preparing=true;
    try {
      const scene=desk.snapshot(), selected=new Set(ids);
      // A member deletion also removes its clip; surviving papers are not deleted.
      const disappearing=scene.filter(o=>selected.has(o.id)||o.type==='clip'&&o.clipMembers?.some(id=>selected.has(id)));
      const frames: {image:HTMLImageElement;box:{x:number;y:number;width:number;height:number}}[]=[];
      const budget=Math.min(2_000_000,8_000_000/Math.max(1,disappearing.length));
      for(const object of disappearing){
        const source=node(object.id);if(!source)continue; // Hidden parts have no visible afterimage.
        const bbox=source.getBBox();
        const scale=Math.min(2,Math.max(.05,camera.zoom),2040/Math.max(1,bbox.width,bbox.height),Math.sqrt(budget/Math.max(1,bbox.width*bbox.height)));
        const raster=await rasterRenderedPart(object,source,scale);
        if(!valid())throw new Error('机が変更されたため、アニメ削除を中止しました');
        const image=new Image();image.src=raster.dataUrl;await image.decode();
        if(!valid())throw new Error('机が変更されたため、アニメ削除を中止しました');
        frames.push({image,box:{x:camera.x+raster.bounds.x*camera.zoom,y:camera.y+raster.bounds.y*camera.zoom,
          width:raster.bounds.width*camera.zoom,height:raster.bounds.height*camera.zoom}});
      }
      if(!valid())throw new Error('机が変更されたため、アニメ削除を中止しました');
      commit();const deletedRevision=desk.revision;render();this.preparing=false;
      if(!frames.length||reduced())return;
      const overlay=document.createElement('canvas');overlay.id='bh-delete-overlay';overlay.dataset.mode=mode;overlay.setAttribute('aria-hidden','true');
      overlay.width=Math.ceil(rect.width);overlay.height=Math.ceil(rect.height);
      Object.assign(overlay.style,{left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`});
      document.body.append(overlay);this.overlay=overlay;
      const ctx=overlay.getContext('2d')!;
      let index=0,started=performance.now();
      const drawFor=(i:number)=>{const {image,box}=frames[i];return bhFrames(ctx,image,mode,box,
        {x:mode==='fall'?box.x+box.width/2:box.x+box.width+Math.min(70,box.width*.2),y:box.y+box.height+Math.min(65,box.height*.2)});};
      let draw=drawFor(0);
      const frame=(now:number)=>{
        if(this.epoch!==epoch)return;
        const currentRect=canvas.getBoundingClientRect();
        if(desk.sessionId!==session||desk.revision!==deletedRevision||reduced()||
          view().x!==camera.x||view().y!==camera.y||view().zoom!==camera.zoom||
          currentRect.width!==rect.width||currentRect.height!==rect.height||currentRect.left!==rect.left||currentRect.top!==rect.top){this.stop();return;}
        // Other already-deleted targets stay visibly in place until their turn.
        ctx.clearRect(0,0,overlay.width,overlay.height);
        draw(Math.min(now-started,BH_DURATION));
        for(let i=index+1;i<frames.length;i++){const f=frames[i];ctx.drawImage(f.image,f.box.x,f.box.y,f.box.width,f.box.height);}
        if(now-started>=BH_DURATION){if(++index>=frames.length){this.stop();return;}started=now;draw=drawFor(index);}
        this.raf=requestAnimationFrame(frame);
      };
      frame(started);
    } finally { if(this.epoch===epoch)this.preparing=false; }
  }
}

export function bhDeleteControls(button: HTMLButtonElement, run:(mode:BhMode)=>void) {
  let mode:BhMode='fall';
  const wrapper=document.createElement('span');wrapper.className='bh-delete-controls';button.replaceWith(wrapper);wrapper.append(button);
  const choose=document.createElement('button');choose.id='delete-style';choose.type='button';choose.textContent='▾';choose.title='アニメ削除の種類';choose.setAttribute('aria-label',choose.title);choose.setAttribute('aria-haspopup','menu');
  const menu=document.createElement('div');menu.id='delete-style-menu';menu.popover='auto';menu.setAttribute('role','menu');
  const sync=()=>{button.textContent='削除';button.title=`BH削除：${mode==='fall'?'落下':'吸引'}（Deleteキーは即削除）`;};
  for(const [value,label] of [['fall','落下で削除'],['suction','吸引で削除']] as const){
    const item=document.createElement('button');item.id=`delete-${value}`;item.type='button';item.setAttribute('role','menuitemradio');
    item.textContent=label;item.onclick=()=>{mode=value;sync();menu.hidePopover();run(mode);};menu.append(item);
  }
  choose.onclick=()=>{
    if(menu.matches(':popover-open')){menu.hidePopover();return;}
    const rect=choose.getBoundingClientRect();menu.style.left=`${Math.max(8,rect.right-170)}px`;menu.style.top=`${Math.max(8,rect.top-96)}px`;
    for(const item of menu.querySelectorAll('button'))item.setAttribute('aria-checked',String(item.id===`delete-${mode}`));menu.showPopover();
  };
  button.onclick=()=>run(mode);wrapper.append(choose);document.body.append(menu);sync();
  return {refresh:()=>{choose.disabled=button.disabled;}};
}
