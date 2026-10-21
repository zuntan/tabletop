import {createMarkdownPreview} from './markdown-preview';
import './bell-note.css';
export function createBellNote(anchor:HTMLButtonElement){
 const panel=document.createElement('div');panel.id='bell-note-panel';panel.popover='manual';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','ベルに添える文章');
 const heading=document.createElement('div');heading.className='bell-note-heading';
 const title=document.createElement('strong');title.textContent='ベルに添える文章';
 const done=document.createElement('button');done.type='button';done.textContent='確定';done.setAttribute('aria-label','文章を保持して閉じる');heading.append(title,done);
 const input=document.createElement('textarea');input.id='bell-note-text';input.maxLength=10000;input.setAttribute('aria-label','ベルに添える文章');input.placeholder='文章なしでもベルを押せます';
 const actions=document.createElement('div');actions.className='inline-editor-actions';
 const hint=document.createElement('small');const mode=document.createElement('button');mode.type='button';mode.className='editor-mode-toggle';mode.textContent='⇄';mode.setAttribute('aria-label','Enter改行モード');actions.append(hint,mode);
 const grip=document.createElement('button');grip.type='button';grip.className='bell-note-resize';grip.setAttribute('aria-label','入力欄のサイズを変更');grip.title='左上へドラッグして広げる';grip.textContent='↖';
 panel.append(heading,input,actions,grip);document.body.append(panel);createMarkdownPreview(panel,input,actions);
 let width=360,height=240,version=0,submitMode='enter';
 try{submitMode=localStorage.getItem('tabletop.editor.submit-key')==='mod-enter'?'mod-enter':'enter';}catch{}
 const syncMode=()=>{hint.textContent=submitMode==='enter'?'Enter：確定 · Shift＋Enter：改行':'Enter：改行 · Ctrl/⌘＋Enter：確定';mode.setAttribute('aria-pressed',String(submitMode==='mod-enter'));};syncMode();
 const opened=()=>panel.matches(':popover-open');
 const close=(focus=false)=>{if(opened())panel.hidePopover();anchor.setAttribute('aria-expanded','false');if(focus)anchor.focus({preventScroll:true});};
 const place=()=>{
  const rect=anchor.getBoundingClientRect(),right=Math.min(innerWidth-8,rect.right),bottom=Math.max(148,rect.top-8);
  width=Math.min(width,Math.max(120,right-8));height=Math.min(height,Math.max(120,Math.min(bottom,innerHeight-8)-8));
  Object.assign(panel.style,{width:`${width}px`,height:`${height}px`,left:`${right-width}px`,top:`${Math.min(bottom,innerHeight-8)-height}px`});
 };
 anchor.title='ベルに添える文章を開く';anchor.setAttribute('aria-label',anchor.title);anchor.setAttribute('aria-haspopup','dialog');anchor.setAttribute('aria-expanded','false');anchor.disabled=false;
 anchor.onclick=()=>{if(opened()){close();return;}panel.showPopover();place();anchor.setAttribute('aria-expanded','true');input.focus({preventScroll:true});};
 done.onclick=()=>close(true);
 input.oninput=()=>{version++;};
 mode.onclick=()=>{submitMode=submitMode==='enter'?'mod-enter':'enter';try{localStorage.setItem('tabletop.editor.submit-key',submitMode);}catch{}syncMode();input.focus();};
 panel.addEventListener('keydown',event=>{
  event.stopPropagation();if(event.key==='Escape'){event.preventDefault();close(true);return;}
  if(event.target===input&&!event.isComposing&&event.key==='Enter'&&!event.shiftKey&&((submitMode==='enter'&&!event.ctrlKey&&!event.metaKey)||(event.ctrlKey||event.metaKey))){event.preventDefault();close(true);}
 });
 panel.addEventListener('pointerdown',event=>event.stopPropagation());
 let drag:{x:number;y:number;width:number;height:number;right:number;bottom:number}|undefined;
 grip.onpointerdown=event=>{if(event.button!==0)return;event.preventDefault();const r=panel.getBoundingClientRect();drag={x:event.clientX,y:event.clientY,width:r.width,height:r.height,right:r.right,bottom:r.bottom};grip.setPointerCapture(event.pointerId);};
 grip.onpointermove=event=>{if(!drag)return;const minWidth=Math.min(240,drag.right-8),minHeight=Math.min(150,drag.bottom-8);width=Math.max(minWidth,Math.min(drag.right-8,drag.width+drag.x-event.clientX));height=Math.max(minHeight,Math.min(drag.bottom-8,drag.height+drag.y-event.clientY));Object.assign(panel.style,{width:`${width}px`,height:`${height}px`,left:`${drag.right-width}px`,top:`${drag.bottom-height}px`});};
 grip.onpointerup=grip.onpointercancel=grip.onlostpointercapture=()=>{drag=undefined;};
 window.addEventListener('resize',()=>{if(opened())place();});
 return {close,snapshot:()=>({text:input.value,draftVersion:version}),collected(value:{draftVersion:number;text:string}){if(value.draftVersion===version&&value.text===input.value){input.value='';version++;}}};
}
