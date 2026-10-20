export type BhMode = 'fall' | 'suction';
export const BH_OPEN = 300, BH_CONSUME = 850, BH_CLOSE = 300;
export const BH_DURATION = BH_OPEN + BH_CONSUME + BH_CLOSE + 50;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
type Point = { x: number; y: number };

/** Texture triangle: one affine map per triangle, vertices shared by neighbouring cells. */
function triangle(ctx: CanvasRenderingContext2D, image: HTMLImageElement, src: Point[], dst: Point[]) {
  const [a,b,c] = src, [p,q,r] = dst;
  const det = (b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y);
  if (Math.abs(det) < .00001) return;
  const aa=((q.x-p.x)*(c.y-a.y)-(r.x-p.x)*(b.y-a.y))/det;
  const cc=((r.x-p.x)*(b.x-a.x)-(q.x-p.x)*(c.x-a.x))/det;
  const bb=((q.y-p.y)*(c.y-a.y)-(r.y-p.y)*(b.y-a.y))/det;
  const dd=((r.y-p.y)*(b.x-a.x)-(q.y-p.y)*(c.x-a.x))/det;
  // Slightly overlap clip edges to avoid antialiased cracks between texture triangles.
  const center={x:(p.x+q.x+r.x)/3,y:(p.y+q.y+r.y)/3};
  const expanded=dst.map(v=>{const dx=v.x-center.x,dy=v.y-center.y,d=Math.hypot(dx,dy)||1;return{x:v.x+dx/d*.75,y:v.y+dy/d*.75};});
  ctx.save(); ctx.beginPath(); ctx.moveTo(expanded[0].x,expanded[0].y); ctx.lineTo(expanded[1].x,expanded[1].y); ctx.lineTo(expanded[2].x,expanded[2].y); ctx.closePath(); ctx.clip();
  ctx.transform(aa,bb,cc,dd,p.x-aa*a.x-cc*a.y,p.y-bb*a.x-dd*a.y);
  ctx.drawImage(image,0,0); ctx.restore();
}

export function bhFrames(ctx: CanvasRenderingContext2D, image: HTMLImageElement, mode: BhMode,
  card: { x: number; y: number; width: number; height: number }, holePoint: Point,
  background?: string) {
  const W=ctx.canvas.width,H=ctx.canvas.height;
  const {x:left,y:top,width:iw,height:ih}=card;
  const {x:hx,y:hy}=holePoint;
    function hole(open: number, phase: number, front=false) {
      if (open<=0) return;
      const rx=(mode==='fall'?Math.max(18,iw*.61):Math.max(18,Math.min(85,iw*.28)))*Math.min(1,open*2.5), ry=Math.max(4,Math.min(mode==='fall'?27:29,ih*.13))*smooth((open-.2)/.8);
      ctx.save();ctx.translate(hx,hy);
      ctx.shadowColor='#a78bfa';ctx.shadowBlur=12*open;ctx.strokeStyle='#c4b5fd';ctx.lineWidth=2;
      ctx.beginPath();
      if (front) { ctx.ellipse(0,0,rx,Math.max(.2,ry),0,0,Math.PI); ctx.closePath(); }
      else ctx.ellipse(0,0,rx,Math.max(.2,ry),0,0,Math.PI*2);
      ctx.fillStyle='#090713';ctx.fill();
      if(front){ctx.beginPath();ctx.ellipse(0,0,rx,Math.max(.2,ry),0,0,Math.PI);}
      ctx.stroke();ctx.shadowBlur=0;
      if (!front && ry>3) {
        ctx.save();ctx.scale(1,ry/rx);ctx.rotate(phase*2);ctx.strokeStyle='#a78bfa55';ctx.lineWidth=2;
        ctx.beginPath();
        for(let i=0;i<90;i++){const a=i*.16,r=rx*.7*i/90;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}
        ctx.stroke();ctx.restore();
      }
      ctx.restore();
    }
    function draw(time: number) {
      ctx.clearRect(0,0,W,H);
      if(background){ctx.fillStyle=background;ctx.fillRect(0,0,W,H);}
      // Three shared phases: opening, consuming, closing.
      const eat=clamp((time-BH_OPEN)/BH_CONSUME), close=clamp((time-BH_OPEN-BH_CONSUME)/BH_CLOSE);
      const opening=time<BH_OPEN?smooth(time/BH_OPEN):1-smooth(close);
      hole(opening,time/1000);
      if(eat<1){
        if(mode==='fall') {
          ctx.save();ctx.beginPath();ctx.rect(0,0,W,hy);ctx.clip();
          const down=eat*eat*(hy-top+ih*.1), shrink=1-.12*smooth(eat);
          ctx.translate(left+iw/2,top+down);ctx.scale(shrink,shrink);ctx.drawImage(image,-iw/2,0,iw,ih);ctx.restore();
        } else if(eat===0) ctx.drawImage(image,left,top,iw,ih);
        else {
          const t=smooth(eat), nx=18, ny=12;
          const map=(u:number,v:number):Point=>{
            const ox=left+u*iw,oy=top+v*ih;
            const dx=ox-hx,dy=oy-hy;
            const near=1-clamp(Math.hypot(dx,dy)/Math.max(80,Math.hypot(iw,ih)*1.5));
            const angle=t*t*(1.2+near*5.5);
            const squeeze=Math.pow(1-t,1.15)*(1-.55*t*near);
            return{x:hx+(dx*Math.cos(angle)-dy*Math.sin(angle))*squeeze,
              y:hy+(dx*Math.sin(angle)+dy*Math.cos(angle))*squeeze};
          };
          ctx.save();ctx.globalAlpha=1-smooth((eat-.87)/.13);
          for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
            const uv=[[x/nx,y/ny],[(x+1)/nx,y/ny],[(x+1)/nx,(y+1)/ny],[x/nx,(y+1)/ny]];
            const source=uv.map(([u,v])=>({x:u*image.width,y:v*image.height}));
            const dest=uv.map(([u,v])=>map(u,v));
            for(const indices of [[0,1,2],[0,2,3]])triangle(ctx,image,indices.map(i=>source[i]),indices.map(i=>dest[i]));
          }
          ctx.restore();
        }
      }
      if(mode==='fall')hole(opening,time/1000,true);
      if(close>.88 && close<1){ctx.fillStyle='#ddd6fe';ctx.beginPath();ctx.arc(hx,hy,2*(1-close)/.12,0,Math.PI*2);ctx.fill();}
    }

  return draw;
}
