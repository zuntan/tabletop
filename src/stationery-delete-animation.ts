/** Disposable canvas effects: the document has already been deleted by the caller. */
export type StationeryMode = 'eraser' | 'particles';
export type EffectBox = { x:number; y:number; width:number; height:number };
export const ERASER_DURATION = 1900;
export const PARTICLE_DURATION = 1500;
const clamp = (n:number) => Math.max(0,Math.min(1,n));
const smooth = (n:number) => {const t=clamp(n);return t*t*(3-2*t);};

/** A bounded mesh, independent of the source raster resolution. No per-frame randomness. */
export function particleMesh(box:EffectBox) {
  const aspect=Math.max(.05,Math.min(20,box.width/Math.max(1,box.height)));
  const columns=Math.max(1,Math.min(32,Math.ceil(Math.sqrt(140*aspect))));
  const rows=Math.max(1,Math.floor(140/columns));
  const pieces:{points:{x:number;y:number}[];cx:number;cy:number}[]=[];
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
    const left=x/columns, right=(x+1)/columns, top=y/rows, bottom=(y+1)/rows;
    const a={x:left,y:top},b={x:right,y:top},c={x:right,y:bottom},d={x:left,y:bottom};
    for(const points of (x+y)%2 ? [[a,b,d],[b,c,d]] : [[a,b,c],[a,c,d]]){
      pieces.push({points,cx:points.reduce((s,p)=>s+p.x,0)/3,cy:points.reduce((s,p)=>s+p.y,0)/3});
    }
  }
  return pieces;
}

export function particleFrames(ctx:CanvasRenderingContext2D,image:HTMLImageElement,box:EffectBox) {
  const pieces=particleMesh(box);
  return (time:number) => {
    if(time>=PARTICLE_DURATION)return;
    if(time<=100){ctx.drawImage(image,box.x,box.y,box.width,box.height);return;}
    for(let i=0;i<pieces.length;i++){
      const p=pieces[i],noise=(n:number)=>{const v=Math.sin((i+1)*n)*43758.5453;return v-Math.floor(v);};
      const delay=100+p.cy*140+noise(12.9898)*100;
      const t=clamp((time-delay)/1050), drift=smooth(t),fade=1-smooth((t-.48)/.52);
      if(fade<=0)continue;
      const points=p.points.map(v=>({x:(v.x-p.cx)*box.width,y:(v.y-p.cy)*box.height}));
      ctx.save();ctx.globalAlpha=fade;
      ctx.translate(box.x+p.cx*box.width+(noise(78.233)-.5)*110*drift,
        box.y+p.cy*box.height-(45+noise(39.425)*100)*drift);
      ctx.rotate((noise(93.73)-.5)*2.4*drift);const scale=1-.7*drift;ctx.scale(scale,scale);
      ctx.beginPath();points.forEach((v,j)=>j?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));ctx.closePath();
      ctx.save();ctx.clip();
      const minX=Math.min(...p.points.map(v=>v.x)),maxX=Math.max(...p.points.map(v=>v.x));
      const minY=Math.min(...p.points.map(v=>v.y)),maxY=Math.max(...p.points.map(v=>v.y));
      ctx.drawImage(image,minX*image.width,minY*image.height,(maxX-minX)*image.width,(maxY-minY)*image.height,
        (minX-p.cx)*box.width,(minY-p.cy)*box.height,(maxX-minX)*box.width,(maxY-minY)*box.height);
      ctx.restore();
      if(t>0){ctx.strokeStyle=`rgba(186,230,253,${.65*Math.sin(Math.PI*t)})`;ctx.lineWidth=.8;ctx.stroke();}
      ctx.restore();
      // Small, soft glints rather than a full-screen flash.
      if(i%7===0&&t>.2&&t<.92){
        const glow=Math.sin(Math.PI*clamp((t-.2)/.72));
        const x=box.x+p.cx*box.width+(noise(78.233)-.5)*110*drift;
        const y=box.y+p.cy*box.height-(45+noise(39.425)*100)*drift;
        ctx.save();ctx.globalAlpha=fade*glow;ctx.strokeStyle='#e0f2fe';ctx.lineWidth=1.2;
        ctx.beginPath();ctx.moveTo(x-3,y);ctx.lineTo(x+3,y);ctx.moveTo(x,y-3);ctx.lineTo(x,y+3);ctx.stroke();ctx.restore();
      }
    }
  };
}

export function eraserFrames(ctx:CanvasRenderingContext2D,image:HTMLImageElement,box:EffectBox,eraser:HTMLImageElement) {
  const surface=document.createElement('canvas');surface.width=image.width;surface.height=image.height;
  const ink=surface.getContext('2d')!;
  const rows=Math.max(3,Math.min(7,Math.ceil(box.height/48)));
  const band=box.height/rows;
  const size=Math.max(48,Math.min(110,Math.max(box.width*.25,band*1.5)));
  return (time:number) => {
    if(time>=ERASER_DURATION)return;
    const progress=clamp((time-140)/1500),pass=Math.min(rows-1,Math.floor(progress*rows));
    const fraction=progress===1?1:progress*rows-pass;
    const reverse=pass%2===1;
    const travel=reverse?1-fraction:fraction;
    ink.clearRect(0,0,surface.width,surface.height);ink.drawImage(image,0,0);
    if(progress>0){
      ink.save();ink.scale(surface.width/box.width,surface.height/box.height);
      ink.globalCompositeOperation='destination-out';
      ink.fillRect(0,0,box.width,pass*band);
      ink.fillRect(reverse?box.width*travel:0,pass*band,box.width*fraction,band);
      ink.restore();
    }
    ctx.drawImage(surface,box.x,box.y,box.width,box.height);
    const exit=smooth((time-1640)/260),entry=smooth(time/140);
    const x=box.x+travel*box.width,y=box.y+(pass+.5)*band;
    const wobble=Math.sin(time*.055)*.06;
    ctx.save();ctx.globalAlpha=entry*(1-exit);ctx.translate(x+exit*35,y-exit*25);ctx.rotate((reverse?-.1:.1)+wobble);
    // Reuse the desk's own smiling eraser; crop the SVG's transparent margins.
    ctx.drawImage(eraser,52,80,310,224,-size*.5,-size*.58,size,size*224/310);ctx.restore();
    // A few crumbs follow the current pass, then disappear with the eraser.
    for(let i=0;i<12;i++){
      const age=((time/70+i*.61)%8)/8;
      ctx.save();ctx.globalAlpha=.6*entry*(1-exit)*(1-age);ctx.strokeStyle=i%2?'#d6b9a8':'#b6cfdf';ctx.lineWidth=2;
      const cx=x+(reverse?1:-1)*(8+age*38)+Math.sin(i*9)*8,cy=y+size*.28+age*18+Math.cos(i*5)*6;
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+3,cy+2);ctx.stroke();ctx.restore();
    }
  };
}
