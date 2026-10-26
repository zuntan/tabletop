import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDesk } from './desk-browser';

test('held Markdown draft preview matches the resized field, clips, and never commits; Enter preference survives reload', { timeout: 60_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('markdown-preview', `
    if (!localStorage.getItem('tabletop.editor.submit-key')) localStorage.setItem('tabletop.editor.submit-key','mod-enter');
    localStorage.setItem('tabletop-ui-theme','dark');
  `);
  try {
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'memo', type: 'text', x: 200, y: 100, width: 480, height: 240, text: 'Original', fill: '#ff0000', textColor: '#00ff00' } }] });
    await page.locator('[data-id="memo"] .markdown-text').dblclick();
    const input = page.locator('[data-inline-text]'), mode = page.getByRole('button', { name: 'Enter改行モード' });
    assert.equal(await mode.getAttribute('aria-pressed'), 'true');
    const stableWidth=async()=>{
      return page.locator('.inline-editor').evaluate(async panel=>{
        const widths:number[]=[];
        for(let i=0;i<12;i++){await new Promise(requestAnimationFrame);widths.push(panel.getBoundingClientRect().width);}
        return Math.max(...widths)-Math.min(...widths);
      });
    };
    assert.ok(await stableWidth()<1,'opening the editor must not grow its width');
    // Even if the panel box model changes, the field must not grow with its parent.
    await page.locator('.inline-editor').evaluate(panel=>{panel.style.padding='12px';});
    assert.ok(await stableWidth()<1,'parent geometry must not cause a resize loop');
    const draft = '# Draft\n\n**bold**\n\n- item\n\n<script>not executable</script>\n\n' + 'more\n'.repeat(60);
    await input.fill(draft);
    await input.evaluate(e => { e.style.height = '180px'; e.style.width = '520px'; });
    assert.ok(await stableWidth()<1,'manual resize must settle');
    const button = page.getByRole('button', { name: 'Markdownプレビュー', exact: true });
    const preview = page.locator('.inline-editor .editor-markdown-preview');
    const rect = await button.boundingBox(); assert.ok(rect);
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down();
    assert.equal(await preview.isVisible(), true);
    assert.equal(await preview.locator('h1').textContent(), 'Draft');
    assert.equal(await preview.locator('strong').textContent(), 'bold');
    assert.equal(await preview.locator('script').count(), 0);
    const layout = await preview.evaluate(e => {
      const input = document.querySelector('[data-inline-text]')!, a = e.getBoundingClientRect(), b = input.getBoundingClientRect();
      const x = getComputedStyle(e), y = getComputedStyle(input);
      return { sameRect: ['x','y','width','height'].every(k => Math.abs(a[k as keyof DOMRect] as number - (b[k as keyof DOMRect] as number)) < 1),
        sameColors: x.backgroundColor === y.backgroundColor && x.color === y.color && x.borderColor === y.borderColor,
        clipped: e.scrollHeight > e.clientHeight && x.overflow === 'hidden' };
    });
    assert.deepEqual(layout, { sameRect: true, sameColors: true, clipped: true });
    assert.equal((await call('desk_get', { id: 'memo' })).text, 'Original');
    await page.mouse.move(1100, 900); await page.mouse.up(); // Capture ends the preview even outside the button.
    assert.equal(await preview.isVisible(), false); assert.equal(await input.inputValue(), draft);
    assert.equal(await input.evaluate(e => e === document.activeElement), true);
    assert.equal(await button.locator('[data-icon="eye"]').count(), 1);
    await button.focus(); await page.keyboard.down('Space'); assert.equal(await preview.isVisible(), true);
    await page.keyboard.up('Space'); assert.equal(await preview.isVisible(), false);
    assert.equal(await input.evaluate(e => e === document.activeElement), true);
    await button.focus(); await page.keyboard.down('Space');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    assert.equal(await preview.isVisible(), false); await page.keyboard.up('Space');
    await mode.click(); assert.equal(await page.evaluate(() => localStorage.getItem('tabletop.editor.submit-key')), 'enter');
    await input.press('Escape'); assert.equal((await call('desk_get', { id: 'memo' })).text, 'Original');
    await page.reload(); await page.locator('[data-add="text"]').click();
    assert.equal(await mode.getAttribute('aria-pressed'), 'false');
    await page.locator('[data-inline-text]').press('Escape');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('card editor starts within the visible workspace at extreme sizes and zooms without changing the card',{timeout:60_000},async()=>{
 const {page,call,close,errors}=await openTestDesk('editor-bounds');
 try{
  await call('desk_execute',{operations:[{kind:'add',object:{id:'bounds-note',type:'text',x:0,y:0,width:5000,height:4000,fontSize:100,text:'Editor bounds'}}]});
  for(const [width,height,zoom,viewportWidth] of [[5000,4000,8,1400],[48,24,.05,1400],[5000,4000,1,540]]){
   await page.setViewportSize({width:viewportWidth,height:900});
   await call('desk_execute',{operations:[{kind:'update',id:'bounds-note',patch:{width,height}}]});
   await call('desk_camera_move',{center:{x:0,y:0},zoom,durationMs:0});
   const before=await call('desk_get',{id:'bounds-note'});
   await page.locator('[data-id="bounds-note"] .markdown-text').dispatchEvent('dblclick',{clientX:-1,clientY:-1});
   const layout=await page.locator('.inline-editor').evaluate(panel=>{
    const box=panel.getBoundingClientRect(),workspace=document.querySelector('#workspace')!.getBoundingClientRect(),input=panel.querySelector('textarea')!;
    return {left:box.left,top:box.top,right:box.right,bottom:box.bottom,minX:Math.max(0,workspace.left),minY:Math.max(0,workspace.top),maxX:Math.min(innerWidth,workspace.right),maxY:Math.min(innerHeight,workspace.bottom),font:getComputedStyle(input).fontSize,width:input.getBoundingClientRect().width,height:input.getBoundingClientRect().height};
   });
   assert.ok(layout.left>=layout.minX&&layout.top>=layout.minY,JSON.stringify(layout));
   assert.ok(layout.right<=layout.maxX+1&&layout.bottom<=layout.maxY+1,JSON.stringify(layout));
   assert.equal(layout.font,'16px');assert.ok(layout.width<=800&&layout.height<=480);
   await page.locator('[data-inline-text]').press('Escape');
   assert.deepEqual(await call('desk_get',{id:'bounds-note'}),before);
  }
  assert.deepEqual(errors,[]);
 }finally{await close();}
});
