import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';
const source='flowchart LR\n  A[開始] --> B{判断}\n  B -->|はい| C[実行]';
test('Mermaid originals render locally, expose SVG/source, recover errors and persist', {timeout:60000},async()=>{
  const {page,call,close,client,errors}=await openTestDesk('mermaid-parts');page.setDefaultTimeout(15000);
  const external:string[]=[];
  await page.route('**/*',route=>{
    if(/^https?:/.test(route.request().url())&&!route.request().url().startsWith('http://127.0.0.1:')) {external.push(route.request().url());return route.abort();}
    return route.continue();
  });
  try{
    await call('desk_execute',{operations:[{kind:'add',object:{id:'m',type:'mermaid',x:100,y:100,width:480,height:354,text:'原本',mermaidSource:source}}]});
    await page.locator('[data-id="m"][data-mermaid-status="ready"]').waitFor();
    const img=page.locator('[data-id="m"] .mermaid-image');assert.match((await img.getAttribute('href'))!,/^data:image\/svg/);
    const svg=await call('desk_asset_read',{id:'m'});assert.match(svg.svg,/開始/);assert.equal(svg.mermaidSource,source);
    // SVG must also decode as a real image (not just appear in the DOM).
    assert.equal(await img.evaluate(async el=>{const image=new Image();image.src=el.getAttribute('href')!;await image.decode();return image.naturalWidth>0&&image.naturalHeight>0;}),true);
    await call('desk_select',{ids:['m']});
    const input=page.locator('#properties textarea[name="mermaidSource"]');
    await input.fill('broken mermaid');await input.blur();
    await page.locator('[data-id="m"][data-mermaid-status="error"]').waitFor();
    assert.equal((await call('desk_get',{id:'m'})).mermaidSource,'broken mermaid');
    const failure=await client.callTool({name:'desk_asset_read',arguments:{id:'m'}});assert.equal(failure.isError,true);
    const sequence='sequenceDiagram\n  participant 人間\n  participant AI\n  人間->>AI: 同じ机を見よう\n  AI-->>人間: はい';
    await input.fill(sequence);await input.blur();
    await page.locator('[data-id="m"][data-mermaid-status="ready"]').waitFor();
    assert.match((await call('desk_asset_read',{id:'m'})).svg,/同じ机/);
    await call('desk_undo');await page.locator('[data-id="m"][data-mermaid-status="error"]').waitFor();
    await call('desk_redo');await page.locator('[data-id="m"][data-mermaid-status="ready"]').waitFor();
    const saved=await call('desk_save',{filename:`mermaid-${Date.now()}.tabletop`});
    await call('desk_execute',{operations:[{kind:'delete',id:'m'}]});
    const state=await call('desk_summary');await call('desk_load',{filename:saved.filename,confirm:true,expectedSessionId:state.sessionId,expectedRevision:state.revision});
    await page.locator('[data-id="m"][data-mermaid-status="ready"]').waitFor();assert.equal((await call('desk_get',{id:'m'})).mermaidSource,sequence);
    assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  }finally{await close();}
});
test('toolbar creates a source card; double click edits source with Enter as newline', {timeout:60000},async()=>{
  const {page,call,close,errors}=await openTestDesk('mermaid-editor');page.setDefaultTimeout(15000);
  try{
    await page.getByRole('button',{name:'Mermaid',exact:true}).click();
    const input=page.locator('[data-inline-mermaid]');await input.fill(source);await input.press('End');await input.press('Enter');
    assert.equal(await input.count(),1);await input.press('Control+Enter');
    const c=await call('desk_context');const m=c.objects.find((o:any)=>o.type==='mermaid');assert.ok(m);assert.equal(m.mermaidSource,source+'\n');
    await page.locator(`[data-id="${m.id}"][data-mermaid-status="ready"]`).waitFor();
    await page.locator(`[data-id="${m.id}"]`).dblclick({position:{x:50,y:15}});
    await input.waitFor();assert.equal(await input.inputValue(),source+'\n');await input.press('Escape');
    assert.deepEqual(errors,[]);
  }finally{await close();}
});
