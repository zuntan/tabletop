import {bytesDataUrl,dataBytes} from './binary-envelope';
import { FILE_EXISTS_MESSAGE, isFileExistsError } from './file-errors';
import { t } from './i18n';
import { uiText, uiAttribute } from './i18n/dom';
import { DeskFileHistory } from './desk-file-history';
import { askFilePath, choiceDialog } from './confirm-dialog';
import type { Desk } from './model';
import { decodeDeskFile, encodeDeskFile, MAX_DESK_FILE_BYTES } from './desk-file';
import { downloadDeskFilename } from './desk-identity';
import './desk-file-menu.css';
import { createIcon } from './icons';
import { headerIcon } from './header-icon';
import { confirmAction, confirmUnsavedChanges, isConfirmDialogOpen } from './confirm-dialog';

export function createDeskFileControls(header: HTMLElement, desk: Desk, refresh: () => void, canLoad: () => boolean, exportPdf?: () => Promise<{bytes:Uint8Array;revision:number;webCount:number}>, remote?:(request:unknown)=>Promise<any>, addDeskLink?:(path:string,name:string)=>void, pages=false, exportPng?: () => Promise<{bytes:Uint8Array;revision:number;webCount:number}>) {
  const save = document.createElement('button');
  save.id = 'download-desk'; headerIcon(save, 'save', t('files:save'));
  const load = document.createElement('button');
  load.id = 'upload-desk'; headerIcon(load, 'load', t('files:uploadShort'));
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.tabletop,.zip'; input.hidden = true; input.id = 'desk-file';
  const trigger=document.createElement('button');trigger.id='file-menu';trigger.type='button';trigger.className='file-menu-trigger';
  trigger.append(createIcon('folder-open',18),uiText(document.createElement('span'), 'files:menu'),document.createTextNode(' ▾'));uiAttribute(trigger,'title','files:menu');uiAttribute(trigger,'aria-label','files:menu');trigger.setAttribute('aria-haspopup','menu');trigger.setAttribute('aria-expanded','false');
  const menu=document.createElement('div');menu.id='file-menu-panel';menu.popover='auto';menu.setAttribute('role','menu');uiAttribute(menu,'aria-label','files:operations');trigger.popoverTargetElement=menu;
  const pdf=document.createElement('button');pdf.id='open-desk-pdf';pdf.type='button';uiText(pdf,'files:openPdf');pdf.disabled=!exportPdf;
  const png=document.createElement('button');png.id='open-desk-png';png.type='button';uiText(png,'files:openPng');png.disabled=!exportPng;
  for(const [button,label]of [[save,'files:download'],[load,'files:upload'],[pdf,'files:openPdf'],[png,'files:openPng']] as const){
    button.type='button';button.classList.remove('header-icon');button.classList.add('file-menu-item');button.setAttribute('role','menuitem');
    if(button!==pdf&&button!==png){const text=document.createElement('span');uiText(text,label);uiAttribute(button,'title',label);uiAttribute(button,'aria-label',label);button.append(text);}menu.append(button);
  }
  const normalSave=document.createElement('button');normalSave.id='save-desk';uiText(normalSave,'files:saveNormal');
  const saveAs=document.createElement('button');saveAs.id='save-desk-as';uiText(saveAs,'files:saveAs');
  const normalLoad=document.createElement('button');normalLoad.id='load-desk';uiText(normalLoad,'files:loadNormal');
  const recent=document.createElement('button');recent.id='recent-desks';uiText(recent,'files:recent');
  const deskLink=document.createElement('button');deskLink.id='add-desk-link';uiText(deskLink,'files:addLink');
  for(const button of [normalSave,saveAs,normalLoad,recent,deskLink]){button.type='button';button.className='file-menu-item';button.setAttribute('role','menuitem');}
  if(pages)for(const button of [normalSave,saveAs,normalLoad,recent,deskLink])button.hidden=true;
  menu.prepend(normalSave,saveAs,normalLoad,recent,deskLink);
  header.append(trigger,input);document.body.append(menu);
  menu.addEventListener('toggle',()=>{const open=menu.matches(':popover-open');trigger.setAttribute('aria-expanded',String(open));if(open){normalSave.title=desk.filePath?t('files:savePath', { path: desk.filePath }):t('files:firstSave');const r=trigger.getBoundingClientRect();menu.style.left=`${Math.max(8,Math.min(r.left,innerWidth-226))}px`;menu.style.top=`${r.bottom+6}px`;}});
  trigger.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='ArrowDown'){event.preventDefault();menu.showPopover();menu.querySelector<HTMLButtonElement>('button:not(:disabled):not([hidden])')?.focus();}});
  menu.addEventListener('keydown',event=>{
    event.stopPropagation();const items=[...menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled):not([hidden])')];
    if(event.key==='Escape'){event.preventDefault();menu.hidePopover();trigger.focus();}
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const current=items.indexOf(document.activeElement as HTMLButtonElement);const index=event.key==='Home'?0:event.key==='End'?items.length-1:(current+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;items[index]?.focus();}
  });
  const report = (text: string,error=false) => { const message=document.querySelector('#message')!;message.removeAttribute('data-i18n');message.textContent = text === FILE_EXISTS_MESSAGE ? t('messages:fileExists') : text;message.classList.toggle('error',error); };
  let saving=false,loading=false,normalBusy=false;
  let storage:Storage|null=null;try{storage=localStorage;}catch{}
  const history=new DeskFileHistory(storage);
  const snapshot=()=>({sessionId:desk.sessionId,revision:desk.revision,generation:desk.documentGeneration,objects:desk.snapshot(),settings:desk.settingsSnapshot()});
  async function saveNormal(as=false){
    if(!remote)throw new Error(t('files:needMcp'));
    const generation=desk.documentGeneration;
    const path=as?await askFilePath(t('files:saveAsTitle'),(desk.filePath??desk.fileNameHint)||downloadDeskFilename(desk.settingsSnapshot().name,t('creation:untitled'))):desk.filePath??await askFilePath(t('files:saveLocation'),desk.fileNameHint||downloadDeskFilename(desk.settingsSnapshot().name,t('creation:untitled')));
    if(!path)return null;
    if(desk.documentGeneration!==generation)throw new Error(t('files:switchedSaving'));
    const overwrite=!as&&!!desk.filePath;
    const saved=snapshot();const bytes=await encodeDeskFile(desk);const archive={sessionId:saved.sessionId,revision:saved.revision,generation:saved.generation,archiveDataUrl:bytesDataUrl(bytes)};let result;
    try{result=await remote({action:'save',path,overwrite,snapshot:archive});}
    catch(error){
      if(!overwrite&&isFileExistsError(error)){
        if(!await confirmAction(t('files:overwriteTitle'),t('files:overwriteMessage', { path }),t('files:overwrite')))return null;
        if(desk.documentGeneration!==generation||desk.revision!==saved.revision)throw new Error(t('files:changedConfirmSaving'));
        result=await remote({action:'save',path,overwrite:true,snapshot:archive});
      }else throw error;
    }
    if(desk.documentGeneration===generation){desk.filePath=result.path;desk.markSaved(saved.revision);history.record(result.path,saved.settings.name);}
    report(t('files:saved', { path: result.path }));return saved.revision;
  }
  async function authorizeSwitch(){
    if(!canLoad()||isConfirmDialogOpen())return false;
    const generation=desk.documentGeneration,revision=desk.revision;
    const choice=desk.hasUnsavedChanges()?await confirmUnsavedChanges():await confirmAction(t('files:loadTitle'),t('files:loadMessage'),t('files:load')).then(ok=>ok?'discard':'cancel');
    if(choice==='cancel')return false;
    if(desk.documentGeneration!==generation||desk.revision!==revision||!canLoad())throw new Error(t('files:changedConfirm'));
    if(choice==='save'){
      if(await (pages?saveDownload(true):saveNormal())===null)return false;
      if(desk.documentGeneration!==generation||desk.revision!==revision||desk.hasUnsavedChanges()||!canLoad())throw new Error(t('files:changedSaving'));
    }
    return true;
  }
  async function loadPath(path:string,initial=false){
    if(normalBusy||loading||saving||!canLoad()||isConfirmDialogOpen())return;
    normalBusy=true;
    try{
      if(!initial&&!await authorizeSwitch())return;
      const generation=desk.documentGeneration,revision=desk.revision;
      const result=await remote?.({action:'load',path});
      if(!result)throw new Error(t('files:needMcp'));
      if(desk.documentGeneration!==generation||desk.revision!==revision||!canLoad())throw new Error(t('files:changedLoading'));
      if(result.archiveDataUrl){const decoded=await decodeDeskFile(dataBytes(result.archiveDataUrl));if(desk.documentGeneration!==generation||desk.revision!==revision||!canLoad())throw Error(t('files:changedLoadingShort'));result.document={objects:decoded.objects,settings:decoded.settings};result.missingAssets=decoded.warnings;}
      desk.replaceDocument(result.document);desk.filePath=result.path;
      history.record(result.path,desk.settingsSnapshot().name);refresh();
      report(t('files:loaded', { path: result.path, warning: result.missingAssets.length ? t('files:missingAssets') : '' }));
      return true;
    }catch(error){report(t('files:loadFailedKept', { error: error instanceof Error ? error.message : String(error) }),true);}
    finally{normalBusy=false;}
  }
  const startSave=(as=false)=>{menu.hidePopover();if(normalBusy||loading||saving||!canLoad())return;normalBusy=true;void saveNormal(as).catch(error=>report(t('files:saveFailed', { error: error instanceof Error ? error.message : String(error) }),true)).finally(()=>{normalBusy=false;});};
  normalSave.onclick=()=>startSave();saveAs.onclick=()=>startSave(true);
  normalLoad.onclick=()=>{menu.hidePopover();if(normalBusy||loading||!canLoad())return;void askFilePath(t('files:askLoad'),desk.filePath??'').then(path=>{if(path)return loadPath(path);}).catch(error=>report(String(error),true));};
  deskLink.onclick=()=>{menu.hidePopover();if(normalBusy||!canLoad())return;void askFilePath(t('files:linkLocation'),desk.filePath??'').then(path=>{if(path&&canLoad())addDeskLink?.(path,path.split(/[\\/]/).pop()??path);}).catch(error=>report(String(error),true));};
  recent.onclick=async()=>{
    menu.hidePopover();if(normalBusy||!canLoad())return;
    const entries=history.list();
    const selected=await choiceDialog({title:t('files:recent'),message:entries.length?t('files:chooseRecent'):t('files:emptyRecent'),cancel:'cancel',choices:[...entries.map((e,i)=>({value:String(i),label:`${e.name||t('files:unnamed')} — ${e.path}`})),{value:'cancel',label:t('files:cancel')}]});
    if(selected==='cancel')return;const entry=entries[Number(selected)];if(!entry)return;
    const action=await choiceDialog({title:entry.name||t('files:recent'),message:entry.path,cancel:'cancel',choices:[{value:'open',label:t('files:open')},{value:'link',label:t('files:addLink')},{value:'remove',label:t('files:removeRecent')},{value:'cancel',label:t('files:cancel')}]});
    if(action==='open')await loadPath(entry.path);
    if(action==='remove')history.remove(entry.path);
    if(action==='link'&&canLoad())addDeskLink?.(entry.path,entry.name||entry.path);
  };
  async function saveDownload(forSwitch=false){
    if(saving)throw new Error(t('files:savingBusy'));
    if(!forSwitch&&(normalBusy||loading))throw new Error(t('files:fileBusy'));
    saving=true;save.disabled=true;
    try {
      const revision = desk.revision;
      const filename = downloadDeskFilename(desk.settingsSnapshot().name,t('creation:untitled'));
      const bytes = await encodeDeskFile(desk);
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer], { type: 'application/zip' }));
      const link = document.createElement('a');
      link.href = url; link.download = filename;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
      desk.markSaved(revision);
      report(t('files:downloaded', { revision }));
      return revision;
    } finally { saving=false;save.disabled = false; }
  }
  save.addEventListener('click', async () => {
    menu.hidePopover();
    try{await saveDownload();}
    catch(error){report(t('files:saveFailed', { error: error instanceof Error ? error.message : String(error) }),true);}
  });
  load.addEventListener('click', () => { menu.hidePopover();if (canLoad()) input.click(); });
  let pdfBusy=false;
  for(const [button,exportImage,format,mime] of [[pdf,exportPdf,'PDF','application/pdf'],[png,exportPng,'PNG','image/png']] as const)button.addEventListener('click',()=>{
    menu.hidePopover();if(pdfBusy||!exportImage)return;
    if(!canLoad()){report(t('files:finishEditing', { format }),true);return;}
    const popup=window.open('about:blank','_blank');
    if(!popup){report(t('files:popupBlocked', { format }),true);return;}
    popup.opener=null;popup.document.title=t('files:generatingTitle', { format });popup.document.body.textContent=t('files:generating', { format });
    pdfBusy=true;pdf.disabled=true;png.disabled=true;report(t('files:exporting', { format }));
    void exportImage().then(result=>{
      if(popup.closed){report(t('files:tabClosed', { format }));return;}
      const url=URL.createObjectURL(new Blob([new Uint8Array(result.bytes).buffer],{type:mime}));
      popup.location.replace(url);const cleanup=setInterval(()=>{if(popup.closed){clearInterval(cleanup);URL.revokeObjectURL(url);}},10_000);
      report(t('files:exportOpened', { revision: result.revision, format, warning: result.webCount ? t('files:webPlaceholder') : '' }));
    }).catch(error=>{if(!popup.closed)popup.close();report(t('files:exportFailed', { format, error: error instanceof Error ? error.message : String(error) }),true);})
      .finally(()=>{pdfBusy=false;pdf.disabled=!exportPdf;png.disabled=!exportPng;});
  });
  input.addEventListener('change', async () => {
    const file = input.files?.[0]; input.value = '';
    if (!file || !canLoad() || loading || normalBusy || isConfirmDialogOpen()) return;
    const revision = desk.revision;
    loading=true;load.disabled = true;
    try {
      if(!await authorizeSwitch())return;
      if (file.size > MAX_DESK_FILE_BYTES) throw new Error('File exceeds 250MB');
      const result = await decodeDeskFile(new Uint8Array(await file.arrayBuffer()));
      if (desk.revision !== revision || !canLoad()) throw new Error('Desk changed during loading; please retry');
      desk.replaceDocument({ objects: result.objects, settings: result.settings });
      desk.fileNameHint=file.name.endsWith('.tabletop')?file.name:`${file.name.replace(/\.[^.]+$/,'')}.tabletop`;
      refresh();
      report(result.warnings.length ? t('files:loadedMissing', { count: result.warnings.length }) : t('files:loadComplete'));
    } catch (error) { report(t('files:loadFailedUnchanged', { error: error instanceof Error ? error.message : String(error) }),true); }
    finally { loading=false;load.disabled = false; }
  });
  return {
    open:loadPath,
    openInitial:(path:string)=>loadPath(path,true),
    openPdfHere:async()=>{
      if(pdfBusy||!exportPdf)return;
      const generation=desk.documentGeneration,revision=desk.revision;
      pdfBusy=true;pdf.disabled=true;report(t('files:exporting', { format: 'PDF' }));
      try{
        const deadline=Date.now()+30_000;
        while(document.querySelector('#canvas [data-mermaid-status="loading"],#canvas [data-qr-status="loading"]')){
          if(Date.now()>deadline)throw new Error(t('files:renderTimeout'));
          await new Promise(resolve=>setTimeout(resolve,50));
        }
        if(desk.documentGeneration!==generation||desk.revision!==revision||!canLoad())throw new Error(t('files:changedPdf'));
        const result=await exportPdf();
        if(desk.documentGeneration!==generation||desk.revision!==revision)throw new Error(t('files:changedPdf'));
        const url=URL.createObjectURL(new Blob([new Uint8Array(result.bytes).buffer],{type:'application/pdf'}));
        location.replace(url);
      }catch(error){report(t('files:exportFailed', { format: 'PDF', error: error instanceof Error ? error.message : String(error) }),true);}
      finally{pdfBusy=false;pdf.disabled=false;}
    },
    record:(path:string)=>history.record(path,desk.settingsSnapshot().name),
    isBusy:()=>normalBusy||loading||saving,
  };
}
