import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openTestDesk} from './desk-browser';

for(const type of ['mermaid','wireloom'] as const)test(`${type} previews the draft in place only while held, without saving or late updates`,{timeout:45_000},async()=>{
  const {page,call,close,errors}=await openTestDesk('diagram-preview-'+type);
  try {
    const original=type==='mermaid'?'flowchart LR; A[Saved]-->B[Original]':'window "Saved":\n  panel:\n    button "Original"';
    const draft=type==='mermaid'?'flowchart TD; A[Draft]-->B[Preview]':'window "Draft":\n  panel:\n    text "Preview this draft" width=140\n    button "Preview"';
    const sourceKey=type==='mermaid'?'mermaidSource':'wireloomSource';
    await call('desk_execute',{operations:[{kind:'add',object:{id:'sample',type,x:200,y:150,width:500,height:400,[sourceKey]:original}}]});
    await call('desk_camera_move',{center:{x:450,y:350},zoom:1,durationMs:0});
    await page.locator('[data-id="sample"]').dblclick({position:{x:30,y:16}});
    const source=page.locator(`[data-inline-${type}]`),button=page.locator('.inline-editor .editor-preview-toggle'),preview=page.locator('.editor-diagram-preview');
    await source.fill(draft);
    const before=await call('desk_state');
    const panel=(await page.locator('.inline-editor').boundingBox())!;
    const input=(await source.boundingBox())!;
    await source.evaluate((el:HTMLTextAreaElement)=>{el.setSelectionRange(2,8);el.scrollTop=10;});
    const pos=(await button.boundingBox())!;
    await page.mouse.move(pos.x+pos.width/2,pos.y+pos.height/2);await page.mouse.down();
    await page.waitForSelector('.editor-diagram-preview[data-preview-status="ready"]');
    const box=(await preview.boundingBox())!;
    assert.ok(Math.abs(box.x-input.x)<=1&&Math.abs(box.y-input.y)<=1);
    assert.ok(Math.abs(box.width-input.width)<=1&&Math.abs(box.height-input.height)<=1);
    assert.deepEqual(await page.locator('.inline-editor').boundingBox(),panel);
    assert.equal(await source.evaluate(el=>getComputedStyle(el).visibility),'hidden');
    assert.equal(await preview.locator('svg,script,iframe').count(),0);
    assert.equal(await preview.locator('img').evaluate((el:HTMLImageElement)=>el.naturalWidth>0),true);
    await page.mouse.move(1100,900);await page.mouse.up();
    assert.equal(await preview.isVisible(),false);assert.equal(await source.inputValue(),draft);
    assert.deepEqual(await source.evaluate((el:HTMLTextAreaElement)=>[el.selectionStart,el.selectionEnd]),[2,8]);
    assert.equal((await call('desk_get',{id:'sample'}))[sourceKey],original);
    assert.equal((await call('desk_summary')).revision,before.revision);
    await source.fill('invalid syntax');await button.focus();await page.keyboard.down('Space');
    await page.waitForSelector('.editor-diagram-preview[data-preview-status="error"]');
    assert.ok(await preview.textContent());await page.keyboard.up('Space');assert.equal(await preview.isVisible(),false);
    await source.fill(draft);await button.focus();await page.keyboard.down('Enter');
    await page.waitForSelector('.editor-diagram-preview[data-preview-status="ready"]');await page.keyboard.up('Enter');
    assert.equal(await source.count(),1);assert.equal((await call('desk_get',{id:'sample'}))[sourceKey],original);
    // Delay decoding so a released hold has a pending result to discard.
    await page.evaluate(()=>{const decode=HTMLImageElement.prototype.decode;HTMLImageElement.prototype.decode=function(){return new Promise<void>(resolve=>setTimeout(resolve,100)).then(()=>decode.call(this));};});
    await button.focus();await page.keyboard.down('Space');await page.keyboard.up('Space');await page.waitForTimeout(200);
    assert.equal(await preview.isVisible(),false);assert.equal(await button.getAttribute('aria-pressed'),'false');
    await source.press('Escape');assert.equal(await page.locator('.inline-editor').count(),0);
    assert.equal((await call('desk_get',{id:'sample'}))[sourceKey],original);
    assert.deepEqual(errors,[]);
  }finally{await close();}
});
