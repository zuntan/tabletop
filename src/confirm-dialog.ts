import './confirm-dialog.css';

let dismiss: (()=>void)|undefined;
export const isConfirmDialogOpen=()=>!!dismiss;
export const cancelConfirmDialog=()=>dismiss?.();

/** A single modal, with cancellation as the initial and dismissal action. */
export function choiceDialog<T extends string>(options:{title:string;message:string;choices:readonly {value:T;label:string;danger?:boolean}[];cancel:T}):Promise<T>{
  // Never stack confirmations or queue an action the human has not seen.
  if(dismiss)return Promise.resolve(options.cancel);
  const cancel=options.choices.find(c=>c.value===options.cancel);
  if(!cancel)throw new Error('A cancellation choice is required');
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const dialog=document.createElement('dialog');dialog.id='confirm-dialog';dialog.className='confirm-dialog';
  dialog.setAttribute('aria-labelledby','confirm-dialog-title');dialog.setAttribute('aria-describedby','confirm-dialog-message');
  const heading=document.createElement('div');heading.className='confirm-dialog-heading';
  const title=document.createElement('h2');title.id='confirm-dialog-title';title.textContent=options.title;
  const close=document.createElement('button');close.type='button';close.className='confirm-dialog-close';close.textContent='×';close.setAttribute('aria-label','閉じる');
  heading.append(title,close);
  const message=document.createElement('p');message.id='confirm-dialog-message';message.textContent=options.message;
  const actions=document.createElement('div');actions.className='confirm-dialog-actions';
  dialog.append(heading,message,actions);
  return new Promise<T>(resolve=>{
    let done=false;
    const finish=(value:T)=>{
      if(done)return;done=true;dismiss=undefined;
      if(dialog.open)dialog.close();dialog.remove();
      if(previous?.isConnected&&!previous.matches(':disabled')&&previous.getClientRects().length)previous.focus({preventScroll:true});
      resolve(value);
    };
    dismiss=()=>finish(options.cancel);
    const buttons=options.choices.map(choice=>{
      const button=document.createElement('button');button.type='button';button.textContent=choice.label;button.dataset.dialogChoice=choice.value;
      if(choice.danger)button.classList.add('confirm-dialog-danger');
      if(choice.value===options.cancel){button.autofocus=true;button.classList.add('confirm-dialog-cancel');}
      button.onclick=()=>finish(choice.value);actions.append(button);return button;
    });
    close.onclick=()=>finish(options.cancel);
    dialog.addEventListener('cancel',event=>{event.preventDefault();finish(options.cancel);});
    dialog.addEventListener('close',()=>finish(options.cancel));
    // Keep Tab inside the choices, including at the browser's focus-cycle boundary.
    dialog.addEventListener('keydown',event=>{
      event.stopPropagation();
      if(event.key==='Tab'){
        const focusable=[close,...buttons].filter(button=>!button.disabled);
        const index=focusable.indexOf(document.activeElement as HTMLButtonElement);
        const next=(index+(event.shiftKey?-1:1)+focusable.length)%focusable.length;
        event.preventDefault();focusable[next].focus();
      }
    });
    dialog.addEventListener('keyup',event=>event.stopPropagation());
    for(const type of ['copy','cut','paste'])dialog.addEventListener(type,event=>event.stopPropagation());
    document.body.append(dialog);
    try{dialog.showModal();buttons[options.choices.indexOf(cancel)].focus();}
    catch{finish(options.cancel);}
  });
}

export function confirmAction(title:string,message:string,action:string){
  return choiceDialog({title,message,cancel:'cancel',choices:[{value:'confirm',label:action},{value:'cancel',label:'キャンセル'}]}).then(value=>value==='confirm');
}

export const confirmUnsavedChanges=()=>choiceDialog({
  title:'未保存の変更があります',message:'現在の机を別の内容へ切り替えます。変更をどうしますか？',cancel:'cancel',
  choices:[{value:'save',label:'保存して切り替える'},{value:'discard',label:'保存せず切り替える',danger:true},{value:'cancel',label:'キャンセル'}],
});
