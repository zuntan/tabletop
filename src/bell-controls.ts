import { uiErrorMessage } from './i18n/errors';
import { uiAttribute } from './i18n/dom';
import { t } from './i18n';
import {createBellNote} from './bell-note';
import './bell-controls.css';
export function createBellControls(fit:HTMLElement,footer:HTMLElement,ring:(note:{text:string;draftVersion:number})=>void,report:(text:string,error?:boolean)=>void){
 const button=document.createElement('button');button.id='desk-bell';button.type='button';button.className='tool-button';button.disabled=true;uiAttribute(button,'title','editing:bell');uiAttribute(button,'aria-label','editing:bell');
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','20');svg.setAttribute('height','20');svg.setAttribute('aria-hidden','true');
 const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d','M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4');path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','1.7');path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');svg.append(path);button.append(svg);fit.after(button);
 const options=document.createElement('button');options.id='desk-bell-options';options.type='button';options.className='tool-button';options.textContent='▲';options.disabled=true;uiAttribute(options,'title','editing:bellOptions');uiAttribute(options,'aria-label','editing:bellOptions');button.after(options);
 const note=createBellNote(options);
 const led=document.createElement('span');led.id='bell-led';led.dataset.lit='false';led.setAttribute('role','img');uiAttribute(led,'aria-label','editing:bellNone');footer.insertBefore(led,footer.querySelector('#ai-activity-led'));
 button.onclick=()=>{try{ring(note.snapshot());note.close();report(t('editing:bellSent'));}catch(error){report(uiErrorMessage(error),true);}};
 button.onkeydown=event=>event.stopPropagation();
 return {collected:note.collected,connected(value:boolean){button.disabled=!value;if(!value)button.removeAttribute('data-waiting');},update(state:{pending:boolean;waiting:number}){led.dataset.lit=String(state.pending);uiAttribute(led,'aria-label',state.pending?'editing:bellPending':'editing:bellNone');uiAttribute(led,'title',state.pending?'editing:bellLit':'editing:bellUnlit');button.dataset.waiting=String(state.waiting>0);uiAttribute(button,'title',state.waiting?'editing:bellWaiting':'editing:bell');}};
}
