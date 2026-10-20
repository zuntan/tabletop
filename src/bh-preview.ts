import './bh-preview.css';

import { bhFrames, BH_DURATION, BH_OPEN, BH_CONSUME } from './bh-animation';
const W = 600, H = 470, DURATION = BH_DURATION;

/** Experimental only: both variants consume the same raster, never a Desk mutation. */
export async function openBhPreview(dataUrl: string) {
  const image = new Image(); image.src = dataUrl; await image.decode();
  document.querySelector<HTMLDialogElement>('#bh-preview')?.close();
  const dialog = document.createElement('dialog'); dialog.id = 'bh-preview';
  const head = document.createElement('div'); head.className = 'bh-preview-heading';
  const title = document.createElement('h2'); title.textContent = 'BH比較実験';
  const close = document.createElement('button'); close.textContent = '閉じる'; close.id = 'bh-preview-close';
  close.onclick = () => dialog.close(); head.append(title, close);
  const note = document.createElement('p'); note.textContent = '同じラスタ画像で比較します。元カードは消えません。';
  const panels = document.createElement('div'); panels.className = 'bh-preview-panels';
  const flights: { play(): void; stop(): void; reset(): void }[] = [];
  for (const mode of ['fall','suction'] as const) {
    const section = document.createElement('section');
    const h = document.createElement('h3'); h.textContent = mode === 'fall' ? 'B案：すとーんと落下' : 'A案：ひねって吸い込み';
    const canvas = document.createElement('canvas'); canvas.width=W; canvas.height=H; canvas.dataset.bhMode=mode;
    canvas.setAttribute('aria-label', h.textContent);
    const ctx=canvas.getContext('2d')!;
    const status=document.createElement('p'); status.className='bh-preview-status'; status.textContent='待機'; status.setAttribute('aria-live','polite');
    const play=document.createElement('button'); play.textContent='再生'; play.dataset.bhPlay=mode;
    section.append(h,canvas,status,play); panels.append(section);
    let raf=0, started=0;
    const scale=Math.min(330/image.width,240/image.height), iw=image.width*scale, ih=image.height*scale;
    const left=(W-iw)/2, top=45;
    const hx=mode==='fall'?W/2:460, hy=mode==='fall'?365:340;
    const draw=bhFrames(ctx,image,mode,{x:left,y:top,width:iw,height:ih},{x:hx,y:hy},'#202631');
    function stop(){cancelAnimationFrame(raf);raf=0;}
    function reset(){stop();draw(0);status.textContent='待機';canvas.dataset.phase='idle';}
    function playAnimation(){
      stop();started=performance.now();canvas.dataset.phase='playing';
      const frame=(now:number)=>{
        if(!dialog.open)return;
        const elapsed=now-started;draw(Math.min(elapsed,DURATION));
        status.textContent=elapsed<BH_OPEN?'前振り':elapsed<BH_OPEN+BH_CONSUME?'飲み込み':'後始末';
        if(elapsed<DURATION)raf=requestAnimationFrame(frame);
        else{raf=0;status.textContent='完了（元カードはそのまま）';canvas.dataset.phase='completed';}
      };
      raf=requestAnimationFrame(frame);
    }
    play.onclick=playAnimation;flights.push({play:playAnimation,stop,reset});reset();
  }
  const controls=document.createElement('div');controls.className='bh-preview-controls';
  const both=document.createElement('button');both.id='bh-preview-both';both.textContent='両方を再生';both.onclick=()=>flights.forEach(f=>f.play());
  const reset=document.createElement('button');reset.id='bh-preview-reset';reset.textContent='最初に戻す';reset.onclick=()=>flights.forEach(f=>f.reset());
  controls.append(both,reset);dialog.append(head,note,panels,controls);
  // Modal shortcuts never reach the desk (Delete, Escape, Space etc.).
  dialog.addEventListener('keydown',event=>event.stopPropagation());
  dialog.addEventListener('close',()=>{flights.forEach(f=>f.stop());dialog.remove();},{once:true});
  document.body.append(dialog);dialog.showModal();both.focus();
}
