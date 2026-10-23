import type { Desk } from './model';
import { decodeDeskFile, encodeDeskFile, MAX_DESK_FILE_BYTES } from './desk-file';
import { downloadDeskFilename } from './desk-identity';
import './desk-file-menu.css';
import { createIcon } from './icons';
import { headerIcon } from './header-icon';
import { confirmAction, confirmUnsavedChanges, isConfirmDialogOpen } from './confirm-dialog';

export function createDeskFileControls(header: HTMLElement, desk: Desk, refresh: () => void, canLoad: () => boolean, exportPdf?: () => Promise<{bytes:Uint8Array;revision:number;webCount:number}>) {
  const save = document.createElement('button');
  save.id = 'save-desk'; headerIcon(save, 'save', '保存');
  const load = document.createElement('button');
  load.id = 'load-desk'; headerIcon(load, 'load', '読込');
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.tabletop,.zip'; input.hidden = true; input.id = 'desk-file';
  const trigger=document.createElement('button');trigger.id='file-menu';trigger.type='button';trigger.className='file-menu-trigger';
  trigger.append(createIcon('folder-open',18),document.createTextNode('ファイル ▾'));trigger.title='ファイル';trigger.setAttribute('aria-label','ファイル');trigger.setAttribute('aria-haspopup','menu');trigger.setAttribute('aria-expanded','false');
  const menu=document.createElement('div');menu.id='file-menu-panel';menu.popover='auto';menu.setAttribute('role','menu');menu.setAttribute('aria-label','ファイル操作');trigger.popoverTargetElement=menu;
  const pdf=document.createElement('button');pdf.id='open-desk-pdf';pdf.type='button';pdf.textContent='PDFで開く';pdf.disabled=!exportPdf;
  for(const [button,label]of [[save,'SAVE（保存）'],[load,'LOAD（読み込み）'],[pdf,'PDFで開く']] as const){
    button.type='button';button.classList.remove('header-icon');button.classList.add('file-menu-item');button.setAttribute('role','menuitem');
    if(button!==pdf){const text=document.createElement('span');text.textContent=label;button.append(text);}menu.append(button);
  }
  header.append(trigger,input);document.body.append(menu);
  menu.addEventListener('toggle',()=>{const open=menu.matches(':popover-open');trigger.setAttribute('aria-expanded',String(open));if(open){const r=trigger.getBoundingClientRect();menu.style.left=`${Math.max(8,Math.min(r.left,innerWidth-206))}px`;menu.style.top=`${r.bottom+6}px`;}});
  trigger.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='ArrowDown'){event.preventDefault();menu.showPopover();menu.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();}});
  menu.addEventListener('keydown',event=>{
    event.stopPropagation();const items=[...menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    if(event.key==='Escape'){event.preventDefault();menu.hidePopover();trigger.focus();}
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const current=items.indexOf(document.activeElement as HTMLButtonElement);const index=event.key==='Home'?0:event.key==='End'?items.length-1:(current+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;items[index]?.focus();}
  });
  const report = (text: string,error=false) => { const message=document.querySelector('#message')!;message.textContent = text;message.classList.toggle('error',error); };
  let saving=false,loading=false;
  async function saveDownload(){
    if(saving)throw new Error('保存処理中です。完了してから再実行してください');
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
    if (!file || !canLoad() || loading || isConfirmDialogOpen()) return;
    const revision = desk.revision;
    loading=true;load.disabled = true;
    try {
      const choice=desk.hasUnsavedChanges()?await confirmUnsavedChanges():await confirmAction('机を読み込みます',
        '現在の机をファイルの内容に置き換えます。読込後は「元に戻す」で戻せます。','読み込む').then(ok=>ok?'discard':'cancel');
      if(choice==='cancel')return;
      if(desk.revision!==revision||!canLoad())throw new Error('確認中に机が変更されました。もう一度読み込んでください');
      if(choice==='save'){
        report('切替前の机を書き出しています…');
        await saveDownload();
        if(desk.revision!==revision||desk.hasUnsavedChanges()||!canLoad())throw new Error('保存中に机が変更されたため、切替を中止しました');
      }
      if (file.size > MAX_DESK_FILE_BYTES) throw new Error('File exceeds 50 MiB');
      const result = await decodeDeskFile(new Uint8Array(await file.arrayBuffer()));
      if (desk.revision !== revision || !canLoad()) throw new Error('Desk changed during loading; please retry');
      desk.replaceDocument({ objects: result.objects, settings: result.settings });
      refresh();
      report(result.warnings.length ? `読込完了（画像欠落 ${result.warnings.length} 件）` : '読込完了');
    } catch (error) { report(`読込失敗（机は変更していません）: ${error instanceof Error ? error.message : String(error)}`,true); }
    finally { loading=false;load.disabled = false; }
  });
}
