import type {DeskObject} from './model';
import {doodleSchema,doodleSource,emptyDoodle,type Doodle} from './doodle-values';
import {createColorControls} from './color-controls';
import './doodle-editor.css';
export function createDoodleEditor(commit:(id:string,patch:Partial<DeskObject>)=>void,report:(text:string,error?:boolean)=>void){
 let active=false;
 function open(object:DeskObject){
  if(active||!object.doodle)return;active=true;
  let data=structuredClone(object.doodle),title=object.text,tool:'pen'|'eraser'|'move'='pen',size=4,index=0;
  const colors=['#111827','#ef4444','#2563eb'];
  type State={data:Doodle;title:string};const past:State[]=[],future:State[]=[];
  const snapshot=():State=>({data:structuredClone(data),title});
  const restore=(s:State)=>{data=structuredClone(s.data);title=s.title;titleInput.value=title;transparent.checked=data.background===null;paperColor.value=data.background&&/^#[0-9a-f]{6}$/i.test(data.background)?data.background:'#ffffff';refresh();};
  const remember=()=>{past.push(snapshot());while(past.length>1&&(past.length>100||past.reduce((n,s)=>n+s.data.strokes.reduce((p,v)=>p+v.points.length,0),0)>500000))past.shift();future.length=0;};
  const dialog=document.createElement('dialog');dialog.id='doodle-editor';dialog.setAttribute('aria-label','落書きの編集');
  const toolbar=document.createElement('div');toolbar.className='doodle-toolbar';
  const titleInput=document.createElement('input');titleInput.value=title;titleInput.maxLength=100000;titleInput.setAttribute('aria-label','落書きのタイトル');
  let titleBefore=title;titleInput.onfocus=()=>{titleBefore=title;};titleInput.onchange=()=>{if(titleBefore!==titleInput.value){past.push({data:structuredClone(data),title:titleBefore});future.length=0;title=titleInput.value;refresh();}};
  toolbar.append(titleInput);
  const button=(caption:string,action:()=>void)=>{const b=document.createElement('button');b.type='button';b.textContent=caption;b.onclick=action;toolbar.append(b);return b;};
  const tools=(['pen','eraser','move'] as const).map((v,i)=>{const b=button(['ペン','消しゴム','絵全体を移動'][i],()=>{tool=v;sync();});b.dataset.doodleTool=v;return b;});
  const sizes=[2,4,8,16,32];for(const n of sizes){const b=button(String(n),()=>{size=n;sync();});b.dataset.doodleSize=String(n);b.title=`太さ ${n}`;}
  const swatches=colors.map((color,i)=>{const b=button('',()=>{index=i;if(tool!=='pen')tool='pen';sync();});b.dataset.doodleColor=String(i);b.setAttribute('aria-label',`色${i+1}`);b.style.background=color;return b;});
  const picker=document.createElement('div');picker.className='doodle-picker';toolbar.append(picker);
  const palette=createColorControls(picker,ops=>{for(const op of ops)if(op.kind==='update'&&op.patch.stroke)colors[index]=op.patch.stroke;sync();},'doodle-',{roles:['stroke'],names:{stroke:'色を変更'},allowTransparent:false,popupContainer:dialog});
  const undo=button('戻す',()=>{if(!past.length||gesture)return;future.push(snapshot());restore(past.pop()!);});undo.id='doodle-undo';
  const redo=button('やり直す',()=>{if(!future.length||gesture)return;past.push(snapshot());restore(future.pop()!);});redo.id='doodle-redo';
  button('全消去',()=>{if(!data.strokes.length||gesture)return;remember();data.strokes=[];refresh();});
  const transparent=document.createElement('input');transparent.type='checkbox';transparent.checked=data.background===null;const bgLabel=document.createElement('label');bgLabel.append(transparent,'透明背景');toolbar.append(bgLabel);
  const paperColor=document.createElement('input');paperColor.type='color';paperColor.value=data.background&&/^#[0-9a-f]{6}$/i.test(data.background)?data.background:'#ffffff';paperColor.setAttribute('aria-label','紙の色');toolbar.append(paperColor);
  transparent.onchange=()=>{remember();data.background=transparent.checked?null:paperColor.value;refresh();};paperColor.onchange=()=>{remember();transparent.checked=false;data.background=paperColor.value;refresh();};
  const width=object.width,height=Math.max(1,object.height-34);
  const stage=document.createElement('div');stage.className='doodle-stage';
  const view=document.createElementNS('http://www.w3.org/2000/svg','svg');view.id='doodle-surface';view.setAttribute('tabindex','0');stage.append(view);
  const paper=document.createElementNS(view.namespaceURI,'image') as SVGImageElement;paper.setAttribute('width',String(width));paper.setAttribute('height',String(height));paper.setAttribute('class','doodle-paper');
  const backing=document.createElementNS(view.namespaceURI,'rect');backing.setAttribute('width',String(width));backing.setAttribute('height',String(height));backing.setAttribute('fill','#f1f5f9');backing.setAttribute('stroke','#94a3b8');view.append(backing,paper);
  const hint=document.createElement('div');hint.className='doodle-hint';hint.textContent='ドラッグ：描く／Space＋ドラッグ・中ボタン：表示を移動／ホイール：拡大縮小';
  const footer=document.createElement('div');footer.className='doodle-footer';footer.append(hint);
  const finish=(save:boolean)=>{if(gesture)return;try{if(save){const parsed=doodleSchema.parse(data);commit(object.id,{doodle:parsed,text:titleInput.value});}dialog.close();dialog.remove();active=false;paletteClose();}catch(e){report(e instanceof Error?e.message:String(e),true);}};
  const paletteClose=()=>palette.destroy();
  const cancel=document.createElement('button');cancel.textContent='キャンセル';cancel.onclick=()=>finish(false);const accept=document.createElement('button');accept.textContent='確定';accept.id='doodle-accept';accept.onclick=()=>finish(true);footer.append(cancel,accept);dialog.append(toolbar,stage,footer);
  let zoom=1,pan={x:0,y:0},space=false;
  type Gesture={id:number;kind:'pan'|'move'|'stroke';x:number;y:number;pan:{x:number;y:number};offset:{x:number;y:number};stroke?:Doodle['strokes'][number]};let gesture:Gesture|undefined;
  const transform=()=>view.setAttribute('viewBox',`${-pan.x/zoom} ${-pan.y/zoom} ${stage.clientWidth/zoom} ${stage.clientHeight/zoom}`);
  const point=(e:PointerEvent)=>{const r=view.getBoundingClientRect();return{x:(e.clientX-r.left-pan.x)/zoom,y:(e.clientY-r.top-pan.y)/zoom};};
  function sync(){tools.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.doodleTool===tool)));toolbar.querySelectorAll<HTMLButtonElement>('[data-doodle-size]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.doodleSize)===size)));swatches.forEach((b,i)=>{b.style.background=colors[i];b.setAttribute('aria-pressed',String(i===index));});palette.update([{...object,type:'line',stroke:colors[index]}]);view.dataset.tool=tool;}
  function refresh(){paper.setAttribute('href',doodleSource(data,width,height));undo.disabled=!past.length;redo.disabled=!future.length;}
  view.onpointerdown=e=>{if(gesture||![0,1].includes(e.button))return;e.preventDefault();view.focus();const p=point(e),kind=e.button===1||space?'pan':tool==='move'?'move':'stroke';
   if(kind==='stroke'&&(p.x<0||p.y<0||p.x>width||p.y>height))return;if(kind!=='pan')remember();gesture={id:e.pointerId,kind,x:e.clientX,y:e.clientY,pan:{...pan},offset:{...data.offset}};
   if(kind==='stroke'){if(data.strokes.length>=512||data.strokes.reduce((n,s)=>n+s.points.length,0)>=100000){past.pop();gesture=undefined;report('線が多いため、別の落書きに続きを描いてください',true);return;}gesture.stroke={tool:tool==='eraser'?'eraser':'pen',color:colors[index],width:size,points:[{x:p.x-data.offset.x,y:p.y-data.offset.y}]};data.strokes.push(gesture.stroke);refresh();}view.setPointerCapture(e.pointerId);
  };
  let frame=0;const schedule=()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;refresh();});};
  view.onpointermove=e=>{const g=gesture;if(!g||g.id!==e.pointerId)return;e.preventDefault();if(g.kind==='pan'){pan={x:g.pan.x+e.clientX-g.x,y:g.pan.y+e.clientY-g.y};transform();return;}
   if(g.kind==='move'){data.offset={x:g.offset.x+(e.clientX-g.x)/zoom,y:g.offset.y+(e.clientY-g.y)/zoom};schedule();return;}
   const events=e.getCoalescedEvents?.()??[e];for(const item of events.length?events:[e]){const p=point(item),q={x:p.x-data.offset.x,y:p.y-data.offset.y},points=g.stroke!.points,last=points.at(-1)!;
    if(Math.hypot(q.x-last.x,q.y-last.y)*zoom<.6)continue;if(points.length>=10000||data.strokes.reduce((n,s)=>n+s.points.length,0)>=100000){report('線が多いため、一度確定してください',true);break;}points.push(q);}schedule();
  };
  const end=(e:PointerEvent)=>{if(gesture?.id!==e.pointerId)return;gesture=undefined;if(view.hasPointerCapture(e.pointerId))view.releasePointerCapture(e.pointerId);refresh();};view.onpointerup=end;view.onlostpointercapture=end;view.onpointercancel=end;
  view.oncontextmenu=e=>e.preventDefault();view.onauxclick=e=>e.preventDefault();
  view.addEventListener('wheel',e=>{e.preventDefault();if(gesture)return;const r=view.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,old=zoom;zoom=Math.max(.05,Math.min(16,zoom*Math.exp(-e.deltaY*.001)));pan={x:x-(x-pan.x)*zoom/old,y:y-(y-pan.y)*zoom/old};transform();},{passive:false});
  dialog.addEventListener('keydown',e=>{e.stopPropagation();if(e.code==='Space'&&!(e.target as Element).closest('input')){space=true;e.preventDefault();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!(e.target as Element).closest('input')){e.preventDefault();(e.shiftKey?redo:undo).click();}});
  dialog.addEventListener('keyup',e=>{e.stopPropagation();if(e.code==='Space')space=false;});for(const name of ['copy','cut','paste'])dialog.addEventListener(name,e=>e.stopPropagation());
  dialog.oncancel=e=>{e.preventDefault();finish(false);};
  const loseFocus=()=>{space=false;if(gesture){const id=gesture.id;gesture=undefined;if(view.hasPointerCapture(id))view.releasePointerCapture(id);refresh();}};window.addEventListener('blur',loseFocus);
  const observer=new ResizeObserver(()=>transform());document.body.append(dialog);dialog.showModal();observer.observe(stage);zoom=Math.min((stage.clientWidth-48)/width,(stage.clientHeight-48)/height,2);zoom=Math.max(.05,zoom);pan={x:(stage.clientWidth-width*zoom)/2,y:(stage.clientHeight-height*zoom)/2};transform();refresh();sync();view.focus();
  dialog.addEventListener('close',()=>{observer.disconnect();window.removeEventListener('blur',loseFocus);if(frame)cancelAnimationFrame(frame);});
 }
 return {open,isActive:()=>active};
}
