import {callTestTool} from './mcp-call';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDesk } from './desk-browser';
import { reactionChoices as reactions } from '../src/reaction-values';

test('human and AI attach reactions to objects and pins with shared Undo and native keyboard toggles', { timeout: 45_000 }, async () => {
  const { page, call, client, close, errors } = await openTestDesk('reactions');
  try {
    await page.locator('#grid-snap').click(); // This test checks reaction placement during an exact drag.
    assert.equal(await page.locator('#reaction-controls').isVisible(), true);
    assert.equal(await page.locator('#reaction-more').isDisabled(), false);
    await call('desk_execute', { operations: [
      { kind: 'add', object: { id: 'memo', type: 'text', x: 200, y: 150, width: 260, height: 180, text: 'Memo' } },
      { kind: 'label_add', id: 'pin', seriesId: 'series-1', x: 600, y: 160 },
      { kind: 'label_add', id: 'sibling', seriesId: 'series-1', x: 700, y: 160 },
      { kind: 'add', object: { id: 'edge', type: 'arrow', x: 650, y: 480, x2: 450, y2: 400 } },
      { kind: 'add', object: { id: 'card', type: 'link', x: 550, y: 270, width: 240, height: 100, url: 'https://example.com/' } },
    ] });
    await call('desk_select', { ids: ['memo'] });
    await page.locator('#reaction-more').click();
    const buttons = page.locator('#reaction-palette [data-reaction]'); assert.equal(await buttons.count(), reactions.length);
    const thumb = page.getByRole('button', { name: '👍 Good', exact: true });
    await thumb.click();
    assert.deepEqual((await call('desk_get', { id: 'memo' })).reactions, ['👍']);
    assert.equal(await thumb.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('[data-reactions="memo"] text').textContent(), '👍');
    assert.equal(await page.locator('[data-reactions="memo"]').getAttribute('pointer-events'), 'none');
    await thumb.press('Enter'); assert.deepEqual((await call('desk_get', { id: 'memo' })).reactions, []);
    await thumb.press('Space'); assert.deepEqual((await call('desk_get', { id: 'memo' })).reactions, ['👍']);
    await page.locator('#undo').click(); assert.deepEqual((await call('desk_get', { id: 'memo' })).reactions, []);
    await page.locator('#redo').click(); assert.equal(await thumb.getAttribute('aria-pressed'), 'true');
    await call('desk_select', { ids: ['memo', 'pin'] }); assert.equal(await thumb.getAttribute('aria-pressed'), 'mixed');
    await thumb.click(); assert.equal(await thumb.getAttribute('aria-pressed'), 'true');
    assert.deepEqual((await call('desk_get', { id: 'pin' })).reactions, ['👍']);
    assert.equal((await call('desk_get', { id: 'sibling' })).reactions, undefined);
    const before = (await call('desk_summary')).revision;
    await thumb.click(); assert.equal((await call('desk_summary')).revision, before + 1);
    assert.equal(await thumb.getAttribute('aria-pressed'), 'false');
    await call('desk_undo'); assert.equal(await thumb.getAttribute('aria-pressed'), 'true');
    await call('desk_execute', { operations: ['memo', 'pin', 'edge', 'card'].map(id => ({ kind: 'update', id, patch: { reactions: [...reactions] } })) });
    for (const id of ['memo', 'pin', 'edge', 'card']) assert.equal(await page.locator(`[data-reactions="${id}"] text`).count(), reactions.length);
    assert.equal((await call('desk_get', { id: 'pin' })).number, 1);
    const context = await call('desk_context'); assert.deepEqual(context.objects.find((object: { id: string }) => object.id === 'pin').reactions, reactions);
    const badgeBox = (await page.locator('[data-reactions="card"]').boundingBox())!;
    const openBox = (await page.locator('[data-id="card"] [data-open-url]').boundingBox())!;
    assert.ok(badgeBox.y > openBox.y + openBox.height);
    const invalid = await callTestTool(client, { name: 'desk_execute', arguments: { operations: [{ kind: 'update', id: 'pin', patch: { reactions: ['👍', '👍'] } }] } });
    assert.equal(invalid.isError, true); assert.equal((await call('desk_summary')).revision, context.revision);
    await call('desk_select', { ids: ['memo'] });
    const box = (await page.locator('[data-id="memo"] > rect').boundingBox())!;
    await page.mouse.move(box.x + 40, box.y + 40); await page.mouse.down();
    await page.mouse.move(box.x + 110, box.y + 60, { steps: 5 });
    assert.equal(await page.locator('[data-id="memo"]').getAttribute('transform'), 'translate(270 170)');
    assert.equal(await page.locator('[data-reactions="memo"] text').count(), reactions.length);
    await page.mouse.up();
    assert.equal((await call('desk_get', { id: 'memo' })).x, 270);
    assert.deepEqual((await call('desk_get', { id: 'memo' })).reactions, reactions);
    await call('desk_execute', { operations: [{ kind: 'delete', id: 'pin' }] });
    assert.equal(await page.locator('[data-reactions="pin"]').count(), 0);
    await call('desk_undo'); assert.equal(await page.locator('[data-reactions="pin"] text').count(), reactions.length);
    await call('desk_select', { ids: [] }); assert.equal(await page.locator('#reaction-controls').isVisible(), true);
    assert.equal(await thumb.isDisabled(), true);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('reaction badge sizes and bottom gaps follow zoom at different zooms, including pins', {timeout:30000},async()=>{
  const {page,call,close,errors}=await openTestDesk('reaction-scale');
  try{
    await call('desk_execute',{operations:[
      {kind:'add',object:{id:'memo',type:'text',x:100,y:100,width:300,height:180,reactions:['👍','💡']}},
      {kind:'add',object:{id:'edge',type:'line',x:100,y:400,x2:400,y2:400,reactions:['👍']}},
      {kind:'label_add',id:'pin',seriesId:'series-1',x:500,y:100,description:'ピンの説明'} ,
      {kind:'update',id:'pin',patch:{reactions:['👍']}}
    ]});
    for(const zoom of [.25,1,3]){
      await call('desk_camera_move',{zoom,durationMs:0});
      for(const id of ['memo','edge','pin']){
        const box=await page.locator(`[data-reactions="${id}"] rect`).first().evaluate(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height};});
        assert.ok(Math.abs(box.width-24*zoom)<.1,`${id} at ${zoom}: width ${box.width}`);
        assert.ok(Math.abs(box.height-24*zoom)<.1,`${id} at ${zoom}: height ${box.height}`);
      }
      const body=await page.locator('[data-id="memo"] > rect').evaluate(el=>{const r=el.getBoundingClientRect();return {y:r.y,height:r.height};});
      const badge=await page.locator('[data-reactions="memo"] rect').first().evaluate(el=>({y:el.getBoundingClientRect().y}));
      assert.ok(Math.abs(badge.y-(body.y+body.height)-8*zoom)<.1);
    }
    assert.equal(await page.locator('[data-reactions="memo"]').count(),1);
    assert.deepEqual(errors,[]);
  }finally{await close();}
});
