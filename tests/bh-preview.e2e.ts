import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { openTestDesk } from './desk-browser';

test('BH comparison replays both rasters without deleting or changing desk state', {timeout:30000}, async()=>{
  const {page,call,close,errors}=await openTestDesk('bh-preview');
  try {
    await call('desk_execute',{operations:[{kind:'add',object:{id:'sample',type:'text',x:100,y:100,width:440,height:320,fontSize:28,padding:24,
      text:'## 消してみたいカード\n\n**これはラスタ画像です。**\n\n- 前振り\n- すとーん／ぎゅー\n- 後始末',fill:'#fff7ed',fillOpacity:1,stroke:'#c7a782'}}]});
    await call('desk_point',{ids:['sample']});
    const before=await call('desk_summary');
    await page.locator('#desk-menu').click();
    const preview=page.locator('#desk-menu-panel .desk-menu-item').filter({hasText:'BH比較（実験）…'});
    assert.equal(await preview.isVisible(),false);
    // Internal verification can invoke the retained experimental handler; the human menu cannot.
    await preview.evaluate((button:HTMLButtonElement)=>button.click());
    await page.locator('#bh-preview').waitFor({state:'visible'});
    await page.locator('#bh-preview-both').click();
    await page.waitForTimeout(700);
    for(const mode of ['fall','suction']){
      const url=await page.locator(`canvas[data-bh-mode="${mode}"]`).evaluate(node=>(node as HTMLCanvasElement).toDataURL());
      await writeFile(`/tmp/tabletop-bh-${mode}.png`,Buffer.from(url.split(',')[1],'base64'));
    }
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('#bh-preview canvas')).every(c=>(c as HTMLElement).dataset.phase==='completed'));
    assert.equal((await call('desk_summary')).revision,before.revision);assert.equal((await call('desk_get',{id:'sample'})).text.includes('ラスタ'),true);
    await page.locator('#bh-preview-reset').click();assert.equal(await page.locator('[data-bh-mode="fall"]').getAttribute('data-phase'),'idle');
    await page.locator('[data-bh-play="suction"]').click();await page.locator('#bh-preview-close').click();
    assert.equal(await page.locator('#bh-preview').count(),0);
    assert.equal((await call('desk_summary')).revision,before.revision);assert.deepEqual(errors,[]);
  }finally{await close();}
});
