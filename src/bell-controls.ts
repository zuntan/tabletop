import {createBellNote} from './bell-note';
import './bell-controls.css';
export function createBellControls(fit:HTMLElement,footer:HTMLElement,ring:(note:{text:string;draftVersion:number})=>void,report:(text:string,error?:boolean)=>void){
 const button=document.createElement('button');button.id='desk-bell';button.type='button';button.className='tool-button';button.disabled=true;button.title='AIを呼ぶ（ベル）';button.setAttribute('aria-label','AIを呼ぶ（ベル）');
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','20');svg.setAttribute('height','20');svg.setAttribute('aria-hidden','true');
 const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d','M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4');path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','1.7');path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');svg.append(path);button.append(svg);fit.after(button);
 const options=document.createElement('button');options.id='desk-bell-options';options.type='button';options.className='tool-button';options.textContent='▲';options.disabled=true;options.title='ベルの追加操作（仕様検討中）';options.setAttribute('aria-label','ベルの追加操作（仕様検討中）');button.after(options);
 const note=createBellNote(options);
 const led=document.createElement('span');led.id='bell-led';led.dataset.lit='false';led.setAttribute('role','img');led.setAttribute('aria-label','ベル通知なし');footer.insertBefore(led,footer.querySelector('#ai-activity-led'));
 button.onclick=()=>{try{ring(note.snapshot());note.close();report('ベルを押しました。次のAI通信でランプが消えます');}catch(error){report(error instanceof Error?error.message:String(error),true);}};
 button.onkeydown=event=>event.stopPropagation();
 return {collected:note.collected,connected(value:boolean){button.disabled=!value;if(!value)button.removeAttribute('data-waiting');},update(state:{pending:boolean;waiting:number}){led.dataset.lit=String(state.pending);led.setAttribute('aria-label',state.pending?'ベル点灯・AI通信待ち':'ベル通知なし');led.title=state.pending?'ベルが押されました（次のAI通信で消灯）':'ベル消灯（通知の受信・対応を保証するものではありません）';button.dataset.waiting=String(state.waiting>0);button.title=state.waiting?'AIがベルを待っています':'AIを呼ぶ（ベル）';}};
}
