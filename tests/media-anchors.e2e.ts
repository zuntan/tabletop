import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDesk } from './desk-browser';
test('line endpoints snap to image, SVG and Mermaid card corners, while props remain unconnectable', { timeout: 60_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('media-anchors');
  try {
    await call('desk_execute', { operations: [{ kind: 'grid_update', patch: { enabled: false } }] });
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40"/></svg>';
    const src = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
    for (const type of ['image','svg','mermaid']) {
      await call('desk_execute', { operations: [
        { kind: 'add', object: { id: type, type, x: 300, y: 150, width: 300, height: 240,
          ...(type === 'mermaid' ? { mermaidSource: 'flowchart LR; A-->B' } : { src }) } },
        { kind: 'add', object: { id: 'edge-'+type, type: 'line', x: 40, y: 400, x2: 140, y2: 400 } },
      ] });
      await call('desk_camera_move', { center: { x: 350, y: 250 }, zoom: 1, durationMs: 0 });
      await call('desk_select', { ids: ['edge-'+type] });
      const target = await page.locator('#viewport').evaluate(el => {
        const p = new DOMPoint(300,150).matrixTransform((el as unknown as SVGGraphicsElement).getScreenCTM()!); return {x:p.x,y:p.y};
      });
      const handle = await page.locator(`[data-connector="edge-${type}"][data-endpoint="end"]`).boundingBox(); assert.ok(handle);
      await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2); await page.mouse.down();
      await page.mouse.move(target.x,target.y,{steps:6}); await page.mouse.up();
      assert.deepEqual((await call('desk_get',{id:'edge-'+type})).endBinding,{objectId:type,anchor:'top-left'});
      await call('desk_execute',{operations:[{kind:'update',id:type,patch:{x:320,y:180,width:400}}]});
      const edge = await call('desk_get',{id:'edge-'+type}); assert.equal(edge.x2,320); assert.equal(edge.y2,180);
      await call('desk_execute',{operations:[{kind:'delete',id:type},{kind:'delete',id:'edge-'+type}]});
    }
    await call('desk_asset_import',{id:'cup',asProp:true,source:{svg},x:300,y:150});
    await call('desk_execute',{operations:[{kind:'label_add',id:'pin',seriesId:'series-1',x:0,y:0}]});
    const rejected = await call('desk_get',{id:'cup'}); assert.equal(rejected.type,'prop');
    assert.equal(await page.locator('[data-id="cup"] [data-open-media]').count(),0);
    assert.deepEqual(errors,[]);
  } finally {await close();}
});
