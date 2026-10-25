import { DeskFileHistory } from './desk-file-history';
import { askFilePath, choiceDialog } from './confirm-dialog';
import type { Desk } from './model';
import { decodeDeskFile, encodeDeskFile, MAX_DESK_FILE_BYTES } from './desk-file';
import { downloadDeskFilename } from './desk-identity';
import './desk-file-menu.css';
import { createIcon } from './icons';
import { headerIcon } from './header-icon';
import { confirmAction, confirmUnsavedChanges, isConfirmDialogOpen } from './confirm-dialog';

export function createDeskFileControls(header: HTMLElement, desk: Desk, refresh: () => void, canLoad: () => boolean, exportPdf?: () => Promise<{bytes:Uint8Array;revision:number;webCount:number}>, remote?:(request:unknown)=>Promise<any>, addDeskLink?:(path:string,name:string)=>void, pages=false) {
  const save = document.createElement('button');
  save.id = 'download-desk'; headerIcon(save, 'save', '保存');
  const load = document.createElement('button');
  load.id = 'upload-desk'; headerIcon(load, 'load', '読込');
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.tabletop,.zip'; input.hidden = true; input.id = 'desk-file';
  const trigger=document.createElement('button');trigger.id='file-menu';trigger.type='button';trigger.className='file-menu-trigger';
  trigger.append(createIcon('folder-open',18),document.createTextNode('ファイル ▾'));trigger.title='ファイル';trigger.setAttribute('aria-label','ファイル');trigger.setAttribute('aria-haspopup','menu');trigger.setAttribute('aria-expanded','false');
  const menu=document.createElement('div');menu.id='file-menu-panel';menu.popover='auto';menu.setAttribute('role','menu');menu.setAttribute('aria-label','ファイル操作');trigger.popoverTargetElement=menu;
  const pdf=document.createElement('button');pdf.id='open-desk-pdf';pdf.type='button';pdf.textContent='PDFで開く';pdf.disabled=!exportPdf;
  for(const [button,label]of [[save,'ダウンロード'],[load,'アップロード'],[pdf,'PDFで開く']] as const){
    button.type='button';button.classList.remove('header-icon');button.classList.add('file-menu-item');button.setAttribute('role','menuitem');
    if(button!==pdf){const text=document.createElement('span');text.textContent=label;button.append(text);}menu.append(button);
  }
  const normalSave=document.createElement('button');normalSave.id='save-desk';normalSave.textContent='SAVE（保存）';
  const saveAs=document.createElement('button');saveAs.id='save-desk-as';saveAs.textContent='SAVE AS（名前を付けて保存）';
  const normalLoad=document.createElement('button');normalLoad.id='load-desk';normalLoad.textContent='LOAD（読み込み）';
  const recent=document.createElement('button');recent.id='recent-desks';recent.textContent='最近使った机';
  const deskLink=document.createElement('button');deskLink.id='add-desk-link';deskLink.textContent='机リンクを置く';
  for(const button of [normalSave,saveAs,normalLoad,recent,deskLink]){button.type='button';button.className='file-menu-item';button.setAttribute('role','menuitem');}
  if(pages)for(const button of [normalSave,saveAs,normalLoad,recent,deskLink])button.hidden=true;
  menu.prepend(normalSave,saveAs,normalLoad,recent,deskLink);
  header.append(trigger,input);document.body.append(menu);
  menu.addEventListener('toggle',()=>{const open=menu.matches(':popover-open');trigger.setAttribute('aria-expanded',String(open));if(open){normalSave.title=desk.filePath?`保存先：${desk.filePath}`:'初回SAVEで保存先を指定';const r=trigger.getBoundingClientRect();menu.style.left=`${Math.max(8,Math.min(r.left,innerWidth-226))}px`;menu.style.top=`${r.bottom+6}px`;}});
  trigger.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='ArrowDown'){event.preventDefault();menu.showPopover();menu.querySelector<HTMLButtonElement>('button:not(:disabled):not([hidden])')?.focus();}});
  menu.addEventListener('keydown',event=>{
    event.stopPropagation();const items=[...menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled):not([hidden])')];
    if(event.key==='Escape'){event.preventDefault();menu.hidePopover();trigger.focus();}
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const current=items.indexOf(document.activeElement as HTMLButtonElement);const index=event.key==='Home'?0:event.key==='End'?items.length-1:(current+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;items[index]?.focus();}
  });
  const report = (text: string,error=false) => { const message=document.querySelector('#message')!;message.textContent = text;message.classList.toggle('error',error); };
  let saving=false,loading=false,normalBusy=false;
  let storage:Storage|null=null;try{storage=localStorage;}catch{}
  const history=new DeskFileHistory(storage);
  const snapshot=()=>({sessionId:desk.sessionId,revision:desk.revision,generation:desk.documentGeneration,objects:desk.snapshot(),settings:desk.settingsSnapshot()});
  async function saveNormal(as=false){
    if(!remote)throw new Error('MCP接続が必要です');
    const generation=desk.documentGeneration;
    const path=as?await askFilePath('名前を付けて保存',(desk.filePath??desk.fileNameHint)||downloadDeskFilename(desk.settingsSnapshot().name)):desk.filePath??await askFilePath('机の保存先',desk.fileNameHint||downloadDeskFilename(desk.settingsSnapshot().name));
    if(!path)return null;
    if(desk.documentGeneration!==generation)throw new Error('机が切り替わったため保存を中止しました');
    const overwrite=!as&&!!desk.filePath;
    const saved=snapshot();let result;
    try{result=await remote({action:'save',path,overwrite,snapshot:saved});}
    catch(error){
      if(!overwrite&&error instanceof Error&&error.message.includes('同名ファイル')){
        if(!await confirmAction('上書き保存します',`${path} の内容を現在の机で置き換えます。`,'上書きする'))return null;
        if(desk.documentGeneration!==generation||desk.revision!==saved.revision)throw new Error('確認中に机が変わったため保存を中止しました');
        result=await remote({action:'save',path,overwrite:true,snapshot:saved});
      }else throw error;
    }
    if(desk.documentGeneration===generation){desk.filePath=result.path;desk.markSaved(saved.revision);history.record(result.path,saved.settings.name);}
    report(`保存完了：${result.path}`);return saved.revision;
  }
  async function authorizeSwitch(){
    if(!canLoad()||isConfirmDialogOpen())return false;
    const generation=desk.documentGeneration,revision=desk.revision;
    const choice=desk.hasUnsavedChanges()?await confirmUnsavedChanges():await confirmAction('机を読み込みます','現在の机をファイル内容に置き換えます。元に戻すで復元できます。','読み込む').then(ok=>ok?'discard':'cancel');
    if(choice==='cancel')return false;
    if(desk.documentGeneration!==generation||desk.revision!==revision||!canLoad())throw new Error('確認中に机が変更されました');
    if(choice==='save'){
      if(await (pages?saveDownload(true):saveNormal())===null)return false;
      if(desk.documentGeneration!==generation||desk.revision!==revision||desk.hasUnsavedChanges()||!canLoad())throw new Error('保存中に机が変更されたため切替を中止しました');
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
      if(!result)throw new Error('MCP接続が必要です');
      if(desk.documentGeneration!==generation||desk.revision!==revision||!canLoad())throw new Error('読込中に机が変更されたため切替を中止しました');
      desk.replaceDocument(result.document);desk.filePath=result.path;
      history.record(result.path,desk.settingsSnapshot().name);refresh();
      report(`読込完了：${result.path}${result.missingAssets.length?'（画像欠落あり）':''}`);
    }catch(error){report(`読込失敗（机は保持）: ${error instanceof Error?error.message:String(error)}`,true);}
    finally{normalBusy=false;}
  }
  const startSave=(as=false)=>{menu.hidePopover();if(normalBusy||loading||saving||!canLoad())return;normalBusy=true;void saveNormal(as).catch(error=>report(`保存失敗: ${error instanceof Error?error.message:String(error)}`,true)).finally(()=>{normalBusy=false;});};
  normalSave.onclick=()=>startSave();saveAs.onclick=()=>startSave(true);
  normalLoad.onclick=()=>{menu.hidePopover();if(normalBusy||loading||!canLoad())return;void askFilePath('机を読み込む',desk.filePath??'').then(path=>{if(path)return loadPath(path);}).catch(error=>report(String(error),true));};
  deskLink.onclick=()=>{menu.hidePopover();if(normalBusy||!canLoad())return;void askFilePath('机リンクの参照先',desk.filePath??'').then(path=>{if(path&&canLoad())addDeskLink?.(path,path.split(/[\\/]/).pop()??path);}).catch(error=>report(String(error),true));};
  recent.onclick=async()=>{
    menu.hidePopover();if(normalBusy||!canLoad())return;
    const entries=history.list();
    const selected=await choiceDialog({title:'最近使った机',message:entries.length?'開く机を選んでください。':'保存・読込に成功した机がここに並びます。',cancel:'cancel',choices:[...entries.map((e,i)=>({value:String(i),label:`${e.name||'名称未設定'} — ${e.path}`})),{value:'cancel',label:'キャンセル'}]});
    if(selected==='cancel')return;const entry=entries[Number(selected)];if(!entry)return;
    const action=await choiceDialog({title:entry.name||'最近使った机',message:entry.path,cancel:'cancel',choices:[{value:'open',label:'開く'},{value:'link',label:'机リンクを置く'},{value:'remove',label:'履歴から外す'},{value:'cancel',label:'キャンセル'}]});
    if(action==='open')await loadPath(entry.path);
    if(action==='remove')history.remove(entry.path);
    if(action==='link'&&canLoad())addDeskLink?.(entry.path,entry.name||entry.path);
  };
  async function saveDownload(forSwitch=false){
    if(saving)throw new Error('保存処理中です。完了してから再実行してください');
    if(!forSwitch&&(normalBusy||loading))throw new Error('ファイル処理が進行中です');
    saving=true;save.disabled=true;
    try {
      const revision = desk.revision;
      const filename = downloadDeskFilename(desk.settingsSnapshot().name);
      const bytes = await encodeDeskFile(desk);
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer], { type: 'application/zip' }));
      const link = document.createElement('a');
      link.href = url; link.download = filename;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
      desk.markSaved(revision);
      report(`revision ${revision} を書き出しました`);
      return revision;
    } finally { saving=false;save.disabled = false; }
  }
  save.addEventListener('click', async () => {
    menu.hidePopover();
    try{await saveDownload();}
    catch(error){report(`保存失敗: ${error instanceof Error ? error.message : String(error)}`,true);}
  });
  load.addEventListener('click', () => { menu.hidePopover();if (canLoad()) input.click(); });
  let pdfBusy=false;
  pdf.addEventListener('click',()=>{
    menu.hidePopover();if(pdfBusy||!exportPdf)return;
    if(!canLoad()){report('編集や操作が終わってからPDFを開いてください',true);return;}
    const popup=window.open('about:blank','_blank');
    if(!popup){report('PDFタブを開けませんでした。ポップアップを許可して再実行してください',true);return;}
    popup.opener=null;popup.document.title='PDFを生成しています…';popup.document.body.textContent='机全体のPDFを生成しています…';
    pdfBusy=true;pdf.disabled=true;report('机全体をPDFにしています…');
    void exportPdf().then(result=>{
      if(popup.closed){report('PDFタブが閉じられたため表示を中止しました');return;}
      const url=URL.createObjectURL(new Blob([new Uint8Array(result.bytes).buffer],{type:'application/pdf'}));
      popup.location.replace(url);const cleanup=setInterval(()=>{if(popup.closed){clearInterval(cleanup);URL.revokeObjectURL(url);}},10_000);
      report(`revision ${result.revision} のPDFを開きました${result.webCount?'（Web資料の本文は代替表示）':''}`);
    }).catch(error=>{if(!popup.closed)popup.close();report(`PDF生成失敗: ${error instanceof Error?error.message:String(error)}`,true);})
      .finally(()=>{pdfBusy=false;pdf.disabled=false;});
  });
  input.addEventListener('change', async () => {
    const file = input.files?.[0]; input.value = '';
    if (!file || !canLoad() || loading || normalBusy || isConfirmDialogOpen()) return;
    const revision = desk.revision;
    loading=true;load.disabled = true;
    try {
      if(!await authorizeSwitch())return;
      if (file.size > MAX_DESK_FILE_BYTES) throw new Error('File exceeds 50 MiB');
      const result = await decodeDeskFile(new Uint8Array(await file.arrayBuffer()));
      if (desk.revision !== revision || !canLoad()) throw new Error('Desk changed during loading; please retry');
      desk.replaceDocument({ objects: result.objects, settings: result.settings });
      desk.fileNameHint=file.name.endsWith('.tabletop')?file.name:`${file.name.replace(/\.[^.]+$/,'')}.tabletop`;
      refresh();
      report(result.warnings.length ? `読込完了（画像欠落 ${result.warnings.length} 件）` : '読込完了');
    } catch (error) { report(`読込失敗（机は変更していません）: ${error instanceof Error ? error.message : String(error)}`,true); }
    finally { loading=false;load.disabled = false; }
  });
  return {
    open:loadPath,
    openInitial:(path:string)=>loadPath(path,true),
    record:(path:string)=>history.record(path,desk.settingsSnapshot().name),
    isBusy:()=>normalBusy||loading||saving,
  };
}
