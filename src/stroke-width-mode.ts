import './stroke-width-mode.css';
/** Two labelled states, with the usual switch semantics: fixed width is ON. */
export function createStrokeWidthMode(input:HTMLInputElement,label:string){
 input.closest('label')?.classList.add('width-mode-field');
 const row=document.createElement('span');row.className='stroke-width-mode';
 const follow=document.createElement('span');follow.textContent='ズーム追従';
 const fixed=document.createElement('span');fixed.textContent='太さ固定';
 const button=document.createElement('button');button.type='button';button.setAttribute('role','switch');button.setAttribute('aria-label',label);button.dataset.widthMode=input.name;
 const track=document.createElement('span');track.className='thinking-switch-track';track.setAttribute('aria-hidden','true');button.append(track);row.append(follow,button,fixed);input.after(row);
 button.onclick=()=>{input.value=String(input.value!=='true');input.dispatchEvent(new Event('change',{bubbles:true}));};
 button.onkeydown=e=>{if(e.key===' '||e.key==='Enter')e.stopPropagation();};
 return()=>{const on=input.value==='true';button.disabled=input.disabled;button.setAttribute('aria-checked',String(on));button.title=on?'ズームしても画面上の太さを保つ':'机のズーム倍率に合わせて太さを変える';row.dataset.fixed=String(on);};
}
