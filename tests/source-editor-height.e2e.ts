import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openTestDesk} from './desk-browser';

test('Mermaid and Wireloom source editors follow displayed card height with text-card limits', {timeout:45_000},async()=>{
  const {page,call,close,errors}=await openTestDesk('source-editor-height');
  try {
    for(const type of ['mermaid','wireloom']) {
      await call('desk_execute',{operations:[{kind:'add',object:{id:type,type,x:100,y:100,width:500,height:300,text:type,
        ...(type==='mermaid'?{mermaidSource:'flowchart LR; A-->B'}:{wireloomSource:'window "Example":\n  panel:\n    button "Save"'})}}]});
      let titleHeight:number|undefined;
      for(const zoom of [1,.5])for(const height of [80,300,1200]) {
        await call('desk_execute',{operations:[{kind:'update',id:type,patch:{height}}]});
        await call('desk_camera_move',{center:{x:350,y:250},zoom,durationMs:0});
        await page.locator(`[data-id="${type}"]`).dblclick({position:{x:30,y:16}});
        const field=page.locator(`[data-inline-${type}]`);await field.waitFor();
        const box=(await field.boundingBox())!;
        assert.ok(Math.abs(box.height-Math.max(160,Math.min(480,height*zoom)))<=1,`${type}: ${height} at ${zoom} => ${box.height}`);
        const title=(await page.locator('[data-inline-text]').boundingBox())!;
        titleHeight??=title.height;assert.equal(title.height,titleHeight);
        const panel=(await page.locator('.inline-editor').boundingBox())!;
        assert.ok(panel.y>=0&&panel.y+panel.height<=1000);
        await field.press('Escape');
      }
      await call('desk_execute',{operations:[{kind:'delete',id:type}]});
    }
    // A short viewport can reduce the minimum so the complete editor remains reachable.
    await page.setViewportSize({width:1100,height:520});
    await call('desk_execute',{operations:[{kind:'add',object:{id:'short',type:'wireloom',x:100,y:100,width:400,height:1000,wireloomSource:'window "Short"'}}]});
    await call('desk_camera_move',{center:{x:300,y:170},zoom:1,durationMs:0});
    await page.locator('[data-id="short"]').dblclick({position:{x:30,y:16}});
    const field=page.locator('[data-inline-wireloom]');await field.waitFor();
    const panel=(await page.locator('.inline-editor').boundingBox())!;
    assert.ok(panel.y>=0&&panel.y+panel.height<=521,JSON.stringify(panel));
    assert.ok((await field.boundingBox())!.height<480);
    await field.press('Escape');assert.deepEqual(errors,[]);
  }finally{await close();}
});
