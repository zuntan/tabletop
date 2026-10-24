import {callTestTool} from './mcp-call';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,rm} from 'node:fs/promises';
import {Desk} from '../src/model';
import {encodeDeskFile,decodeDeskFile} from '../src/desk-file';
import {openTestDesk} from './desk-browser';

test('shared modal defaults to cancel, traps keys, blocks AI edits, and supports save/discard/cancel',{timeout:30000},async()=>{
  const {page,call,client,close,errors}=await openTestDesk('confirm-dialog');
  try{
    const other=new Desk();other.execute({operations:[{kind:'add',object:{id:'loaded',type:'text',text:'New desk'}}]});
    const bytes=Buffer.from(await encodeDeskFile(other));
    const upload=()=>page.locator('#desk-file').setInputFiles({name:'other.tabletop',mimeType:'application/zip',buffer:bytes});
    await call('desk_execute',{operations:[{kind:'add',object:{id:'kept',type:'text',text:'Keep my changes'}}]});
    await call('desk_select',{ids:['kept']});const original=await call('desk_state');
    const dialog=page.locator('#confirm-dialog');
    await upload();await dialog.waitFor();
    assert.equal(await page.locator('[data-dialog-choice="cancel"]').evaluate(el=>el===document.activeElement),true);
    assert.equal(await dialog.locator('[data-dialog-choice]').count(),3);
    const denied=await callTestTool(client, {name:'desk_execute',arguments:{operations:[{kind:'delete',id:'kept'}]}});assert.equal(denied.isError,true);
    await page.keyboard.press('Control+z');await page.keyboard.press('Delete');assert.deepEqual(await call('desk_state'),original);
    await page.evaluate(()=>{
      const data=new DataTransfer();data.setData('text/plain','Do not paste behind the confirmation');
      document.activeElement!.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));
      window.dispatchEvent(new ClipboardEvent('cut',{clipboardData:data,bubbles:true,cancelable:true}));
    });
    assert.deepEqual(await call('desk_state'),original);
    await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement?.closest('#confirm-dialog')),true);
    await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});assert.deepEqual(await call('desk_state'),original);
    await upload();await dialog.waitFor();await page.keyboard.press('Enter');await dialog.waitFor({state:'detached'});assert.deepEqual(await call('desk_state'),original);
    await upload();await dialog.waitFor();await page.getByRole('button',{name:'閉じる',exact:true}).click();assert.deepEqual(await call('desk_state'),original);
    await mkdir('tmp/confirm-dialog',{recursive:true});
    await upload();await dialog.waitFor();await page.screenshot({path:'tmp/confirm-dialog/unsaved-light.png'});
    await page.locator('[data-dialog-choice="cancel"]').click();
    await call('desk_ui_set',{theme:'dark'});await upload();await dialog.waitFor();await page.screenshot({path:'tmp/confirm-dialog/unsaved-dark.png'});
    const savedPath=`/tmp/confirm-switch-${crypto.randomUUID()}.tabletop`;await page.locator('[data-dialog-choice="save"]').click();
    await page.getByRole('textbox',{name:'机ファイルのパス',exact:true}).fill(savedPath);await page.locator('[data-dialog-choice="accept"]').click();
    await page.waitForFunction(()=>document.querySelector('#message')?.textContent==='読込完了');
    const saved=await decodeDeskFile(await readFile(savedPath));assert.equal(saved.objects[0].id,'kept');await rm(savedPath);
    assert.equal((await call('desk_summary')).count,1);assert.equal((await call('desk_get',{id:'loaded'})).text,'New desk');
    await upload();await dialog.waitFor();assert.equal(await dialog.locator('[data-dialog-choice]').count(),2);await page.keyboard.press('Escape');
    assert.deepEqual(errors,[]);
  }finally{await close();}
});

test('save failure aborts replacement; successful MCP save clears warning and failed MCP save does not',{timeout:25000},async()=>{
  const {page,call,client,close,errors}=await openTestDesk('confirm-save');
  try{
    const bytes=Buffer.from(await encodeDeskFile(new Desk()));
    const upload=()=>page.locator('#desk-file').setInputFiles({name:'empty.tabletop',mimeType:'application/zip',buffer:bytes});
    await call('desk_execute',{operations:[{kind:'add',object:{id:'kept',type:'rect'}}]});const before=await call('desk_state');
    await upload();await page.locator('[data-dialog-choice="save"]').click();
    await page.getByRole('textbox',{name:'机ファイルのパス',exact:true}).fill('/no-such-tabletop-directory/file.tabletop');await page.locator('[data-dialog-choice="accept"]').click();
    await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.includes('ENOENT'));
    assert.equal(await page.locator('#message').evaluate(el=>el.classList.contains('error')),true);assert.deepEqual(await call('desk_state'),before);
    const filename=`confirm-saved-${crypto.randomUUID()}.tabletop`;
    assert.equal((await call('desk_save',{filename})).browserSavedState,'updated');
    await upload();await page.locator('#confirm-dialog').waitFor();assert.equal(await page.locator('[data-dialog-choice="save"]').count(),0);await page.keyboard.press('Escape');
    await call('desk_execute',{operations:[{kind:'update',id:'kept',patch:{x:100}}]});
    assert.equal((await callTestTool(client, {name:'desk_save',arguments:{filename}})).isError,true);
    await upload();await page.locator('#confirm-dialog').waitFor();assert.equal(await page.locator('[data-dialog-choice="save"]').count(),1);await page.keyboard.press('Escape');
    assert.deepEqual(errors,[]);
  }finally{await close();}
});
