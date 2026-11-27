import {uiAttribute,type UiKey} from './i18n/dom';
import {createIcon} from './icons';

/** Hold to inspect the draft in place; never submit it or resize the editor. */
export function createHeldEditorPreview(panel:HTMLElement,input:HTMLTextAreaElement,actions:HTMLElement,options:{
  className:string;title:UiKey;label:UiKey;draftLabel:UiKey;
  render:(preview:HTMLElement,isCurrent:()=>boolean)=>void;
}) {
  const button=document.createElement('button');button.type='button';button.className='editor-preview-toggle';
  button.append(createIcon('eye',18));uiAttribute(button,'title',options.title);
  uiAttribute(button,'aria-label',options.label);button.setAttribute('aria-pressed','false');
  const preview=document.createElement('div');preview.className=options.className;preview.hidden=true;
  uiAttribute(preview,'aria-label',options.draftLabel);preview.inert=true;
  panel.append(preview);actions.append(button);
  let showing=false,generation=0;
  const stop=(returnFocus=false)=>{
    const wasShowing=showing;++generation;showing=false;preview.hidden=true;
    input.style.visibility='';button.setAttribute('aria-pressed','false');
    if(wasShowing&&returnFocus&&input.isConnected)input.focus({preventScroll:true});
  };
  const start=()=>{
    if(showing)return;
    showing=true;const current=++generation,style=getComputedStyle(input);
    Object.assign(preview.style,{left:`${input.offsetLeft}px`,top:`${input.offsetTop}px`,
      width:`${input.offsetWidth}px`,height:`${input.offsetHeight}px`,
      background:style.backgroundColor,color:style.color,border:style.border,
      borderRadius:style.borderRadius,padding:style.padding,fontSize:style.fontSize});
    preview.replaceChildren();preview.hidden=false;input.style.visibility='hidden';button.setAttribute('aria-pressed','true');
    options.render(preview,()=>showing&&generation===current&&panel.isConnected);
  };
  button.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    event.preventDefault();button.setPointerCapture(event.pointerId);start();
  });
  button.addEventListener('pointerup',()=>stop(true));
  button.addEventListener('pointercancel',()=>stop(true));
  button.addEventListener('lostpointercapture',()=>stop());
  button.addEventListener('keydown',event=>{
    if(event.key===' '||event.key==='Enter'){event.preventDefault();start();}
  });
  button.addEventListener('keyup',event=>{
    if(event.key===' '||event.key==='Enter'){event.preventDefault();stop(true);}
  });
  const blur=()=>stop();button.addEventListener('blur',blur);window.addEventListener('blur',blur);
  return ()=>{window.removeEventListener('blur',blur);stop();};
}
