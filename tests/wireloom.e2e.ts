import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openTestDesk} from './desk-browser';

test('Wireloom creates, edits, exports and restores a source card with errors recoverable', {timeout:60_000},async()=>{
  const {page,call,close,errors}=await openTestDesk('wireloom');
  try {
    const initial=await call('desk_list');
    if(initial.objects.length)await call('desk_execute',{operations:initial.objects.map((o:{id:string})=>({kind:'delete',id:o.id}))});
    await page.locator('[data-add="wireloom"]').click();
    const source=page.locator('[data-inline-wireloom]');await source.waitFor();
    const original=await source.inputValue();assert.ok(original.includes('設定'));
    assert.equal(await page.locator('[data-wireloom-preview]').count(),0);
    const sample='window "確認":\n  panel:\n    text "これは長い注意書きです。保存する前に変更内容を確認してください。" width=180\n    checkbox "通知を表示する" checked label-right\n  footer:\n    button "取消"\n    button "保存" primary';
    await source.fill(sample);
    await source.press('Control+Enter');
    const id=(await call('desk_selection')).ids[0];
    await page.waitForSelector(`[data-id="${id}"][data-wireloom-status="ready"]`);
    assert.equal((await call('desk_get',{id})).wireloomSource,sample);
    const rendered=await call('desk_asset_read',{id});assert.equal(rendered.wireloomSource,sample);assert.ok(rendered.svg.includes('通知を表示する'));
    const card=page.locator(`[data-id="${id}"]`);await card.dblclick();
    await source.fill('broken syntax');
    assert.equal((await call('desk_get',{id})).wireloomSource,sample);
    await source.press('Control+Enter');await page.waitForSelector(`[data-id="${id}"][data-wireloom-status="error"]`);
    await card.dblclick();await source.fill(sample);await source.press('Control+Enter');
    await page.waitForSelector(`[data-id="${id}"][data-wireloom-status="ready"]`);
    await call('desk_undo');assert.equal((await call('desk_get',{id})).wireloomSource,'broken syntax');await call('desk_redo');
    await page.waitForSelector(`[data-id="${id}"][data-wireloom-status="ready"]`);
    assert.equal(await card.locator('image').evaluate(async el=>{const image=new Image();image.src=el.getAttribute('href')!;await image.decode();return image.naturalWidth>0;}),true);
    const svg=await card.locator('image').getAttribute('href');assert.ok(svg?.startsWith('data:image/svg+xml'));
    // Same-desk Markdown references use the generated image, not an executable SVG DOM.
    await call('desk_execute',{operations:[{kind:'add',object:{id:'ref',type:'text',x:0,y:0,width:500,height:400,text:`![Wireframe](tabletop://./${id})`}}]});
    await page.waitForSelector('[data-id="ref"] [data-image-status="ready"]');
    const saved=await call('desk_save',{path:'/tmp/tabletop-wireloom-e2e.tabletop',overwrite:true});
    const state=await call('desk_state');
    await call('desk_execute',{operations:[{kind:'delete',id}]});
    await call('desk_load',{path:saved.path,confirm:true,expectedSessionId:state.sessionId,expectedRevision:(await call('desk_summary')).revision});
    await page.waitForSelector(`[data-id="${id}"][data-wireloom-status="ready"]`);
    assert.equal((await call('desk_get',{id})).wireloomSource,sample);
    await call('desk_select',{ids:[id]});
    const property=page.locator('#properties textarea[name="wireloomSource"]');assert.equal(await property.inputValue(),sample);
    await property.fill(sample.replace('確認','確認済み'));await property.blur();
    await page.waitForSelector(`[data-id="${id}"][data-wireloom-status="ready"]`);
    assert.ok((await call('desk_asset_read',{id})).svg.includes('確認済み'));
    await call('desk_undo');
    await page.waitForSelector(`[data-id="${id}"][data-wireloom-status="ready"]`);
    const before=await call('desk_summary');await call('desk_asset_read',{id});assert.equal((await call('desk_summary')).revision,before.revision);
    const png=await call('desk_raster',{ids:[id],scale:1});assert.ok(png.width>0);
    const pdf=await call('desk_pdf',{path:'/tmp/tabletop-wireloom-e2e.pdf',overwrite:true});assert.ok(pdf.path);
    await card.screenshot({path:'/tmp/tabletop-wireloom-card.png'});
    assert.deepEqual(errors,[]);
  } finally {await close();}
});
