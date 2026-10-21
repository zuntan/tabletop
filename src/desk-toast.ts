import info from './assets/toast/info.svg?raw';
import success from './assets/toast/success.svg?raw';
import warning from './assets/toast/warning.svg?raw';
import question from './assets/toast/question.svg?raw';
import hint from './assets/toast/hint.svg?raw';
import './desk-toast.css';
const icons={info,success,warning,question,hint};
export function createDeskToast(){
 const panel=document.createElement('div');panel.id='desk-toast';panel.popover='manual';
 const icon=document.createElement('span');icon.className='desk-toast-icon';icon.setAttribute('aria-hidden','true');
 const text=document.createElement('div');text.className='desk-toast-text';text.setAttribute('role','status');text.setAttribute('aria-live','polite');
 const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','AIメッセージを閉じる');
 panel.append(icon,text,close);document.body.append(panel);
 let timer:ReturnType<typeof setTimeout>|undefined;
 const hide=()=>{clearTimeout(timer);if(panel.matches(':popover-open'))panel.hidePopover();};close.onclick=hide;
 const place=()=>{
  if(!panel.matches(':popover-open'))return;
  const note=document.querySelector('#bell-note-panel:popover-open');
  const anchor=note??document.querySelector('.toolbar-view');if(!anchor)return;
  const r=anchor.getBoundingClientRect();
  panel.style.width=`${Math.min(360,innerWidth-16,innerWidth-Math.max(8,r.left)-8)}px`;
  panel.style.left=`${Math.max(8,Math.min(innerWidth-panel.offsetWidth-8,r.left))}px`;
  panel.style.top=`${Math.max(8,r.top-panel.offsetHeight-8)}px`;
 };
 const note=document.querySelector('#bell-note-panel');
 if(note){new MutationObserver(place).observe(note,{attributes:true,attributeFilter:['style']});note.addEventListener('toggle',place);}
 new ResizeObserver(place).observe(panel);
 window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
 panel.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape')hide();});panel.addEventListener('pointerdown',e=>e.stopPropagation());
 return {show(value:{text:string;icon:keyof typeof icons;durationMs:number}){
  hide();icon.innerHTML=icons[value.icon]??icons.info;text.textContent=value.text;
  panel.showPopover();place();if(value.durationMs>0)timer=setTimeout(hide,value.durationMs);
 }};
}
