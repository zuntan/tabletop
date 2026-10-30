import {createIcon} from './icons';
import './topbar-collapse.css';

/** Move the existing lock control rather than duplicating its state or actions. */
export function createTopbarCollapse(app:HTMLElement, canToggle:()=>boolean, resized:()=>void) {
  const header=app.querySelector<HTMLElement>('header')!;
  const lock=app.querySelector<HTMLButtonElement>('#mouse-lock')!;
  const slot=document.createComment('mouse-lock toolbar position');lock.before(slot);
  const toggle=document.createElement('button');toggle.type='button';toggle.id='topbar-toggle';
  header.append(toggle);
  let collapsed=false;
  try{collapsed=localStorage.getItem('tabletop.topbar.collapsed')==='true';}catch{/* In-memory fallback. */}
  const apply=()=>{
    app.classList.toggle('topbar-collapsed',collapsed);
    const icon=createIcon(collapsed?'chevron-down':'chevron-up',16);icon.setAttribute('stroke-width','2');
    toggle.replaceChildren(icon);toggle.title=collapsed?'上部の操作帯を開く':'上部の操作帯を畳む';
    toggle.setAttribute('aria-label',toggle.title);toggle.setAttribute('aria-expanded',String(!collapsed));
    if(collapsed){
      for(const popup of app.querySelectorAll<HTMLElement>(':popover-open'))popup.hidePopover();
      toggle.before(lock);
    }else slot.after(lock);
    requestAnimationFrame(resized);
  };
  toggle.onclick=()=>{if(!canToggle())return;collapsed=!collapsed;try{localStorage.setItem('tabletop.topbar.collapsed',String(collapsed));}catch{/* In-memory fallback. */}apply();};
  apply();
}
