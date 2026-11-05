import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDesk } from './desk-browser';
import { mkdir } from 'node:fs/promises';

test('stamp palette, arbitrary fallback text, selection retreat, resize and shared Undo', { timeout: 60_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('stamps');
  try {
    const patterns = await call('desk_stamp_patterns');
    assert.equal(patterns.patterns.length, 38); assert.equal(patterns.fallback.internalOnly, true);
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'memo', type: 'text', x: 200, y: 150, width: 400, height: 280, text: 'ハンコのメモ' } }] });
    await page.locator('[data-id="memo"]').first().click({ position: { x: 100, y: 60 } });
    await page.locator('#stamp-menu').click();
    assert.equal(await page.locator('[data-stamp-design]').count(),38);
    assert.equal(await page.locator('.stamp-choices h3').count(),0);
    assert.deepEqual(await page.locator('[data-stamp-design]').evaluateAll(nodes=>nodes.map(n=>(n as HTMLElement).dataset.stampDesign)),[
      'done_ja','done_en','on_hold_ja','on_hold_en','unread_ja','unread_en','read_ja','read_en',
      'pass_ja','pass_en','fail_ja','fail_en','rejected_ja','rejected_en','physical_checked_ja','keep_secret_ja',
      'sealed_ja','sealed_en','confidential_ja','confidential_en','do_not_remove_ja','caution_en','danger_en','handle_with_care_en',
      'hanamaru_ja','smile_ja','well_done_ja','keep_going_ja','excellent_en','good_en','bad_en','handle_with_care_ja',
      'nandeyanen_ja','shirangana_ja','wanted_ja','wanted_en','copy_paste_only_ja','copy_paste_only_en'
    ]);

    await page.screenshot({path:'/tmp/stamp-compact.png'});const paletteBox=await page.locator('#stamp-palette').boundingBox();assert.ok(paletteBox!.width<410);assert.ok(paletteBox!.height<410,JSON.stringify(paletteBox));
    assert.equal(await page.locator('.stamp-sample-box #stamp-dated').count(),1);
    await page.locator('[data-stamp-design=confidential_en]').hover();assert.equal(await page.locator('#stamp-sample-name').textContent(),'CONFIDENTIAL');
    await page.locator('[data-stamp-design=unread_en]').focus();assert.equal(await page.locator('#stamp-sample-name').textContent(),'UNREAD');
    assert.equal((await call('desk_get',{id:'memo'})).stamp,undefined);
    await page.locator('#stamp-dated').check();
    await page.locator('[data-stamp-design="good_en"]').hover();
    await page.locator('#stamp-sample-button').click();
    const enlarged=(await call('desk_get',{id:'memo'})).stamp;
    assert.equal(enlarged.designId,'good_en');assert.match(enlarged.text,/^\d{4}\.\d{2}\.\d{2}$/);
    await call('desk_undo');assert.equal((await call('desk_get',{id:'memo'})).stamp,undefined);
    await page.locator('#stamp-dated').uncheck();
    for(const [ja,en] of [['unread_ja','unread_en'],['read_ja','read_en'],['pass_ja','pass_en'],['fail_ja','fail_en'],['wanted_ja','wanted_en']]){
      assert.equal(await page.locator(`[data-stamp-design="${ja}"]`).evaluate((el,id)=>(el.nextElementSibling as HTMLElement)?.dataset.stampDesign,en),en);
    }
    for (const id of ['on_hold_ja','on_hold_en','handle_with_care_ja','handle_with_care_en','wanted_en','confidential_en','unread_en','read_ja','pass_ja','copy_paste_only_ja','keep_going_ja','shirangana_ja','nandeyanen_ja']) {
      await page.locator(`[data-stamp-design="${id}"]`).click();
      assert.equal((await call('desk_get', { id: 'memo' })).stamp.designId, id);
    }
    assert.equal(await page.locator('#stamp-palette parsererror').count(),0);
    for(const design of patterns.patterns.filter((p:any)=>['physical_checked_ja','wanted_en','confidential_en','unread_en','pass_ja'].includes(p.id))){
      const preview=page.locator(`[data-stamp-design="${design.id}"] svg`);
      assert.ok(await preview.locator('path,rect,circle').count()>0);
    }
    await mkdir('tmp/stamps', { recursive: true });
    await page.locator('#stamp-palette').screenshot({ path: 'tmp/stamps/palette.png' });
    const praise = page.locator('[data-stamp-design="well_done_ja"] svg');
    assert.ok((await praise.textContent())?.includes('たいへんよくできました'));
    assert.equal(await praise.locator('[data-stamp-outline]').count(), 11); // Three upright vertical columns alongside the cherry-blossom border.
    assert.equal(await praise.locator('[data-stamp-petal-dot]').count(),5);
    const encouragement=page.locator('[data-stamp-design="keep_going_ja"] svg');
    assert.ok((await encouragement.textContent())?.includes('がんばりましょう'));
    assert.equal(await encouragement.locator('path').first().getAttribute('d'),await praise.locator('path').first().getAttribute('d'));
    const clear=page.locator('#stamp-clear'),last=page.locator('[data-stamp-design="shirangana_ja"]');
    assert.equal(await clear.textContent(),'取り消し');
    const cr=await clear.boundingBox(),lr=await last.boundingBox();assert.ok(cr!.height<lr!.height);assert.ok(cr!.y>lr!.y);
    await call('desk_execute',{operations:[{kind:'update',id:'memo',patch:{stamp:{designId:'handle_with_care_en',text:'legacy',angle:-6}}}]});
    assert.equal(await page.locator('[data-id="memo"] [data-stamp="handle_with_care_en"] path').count()>0,true);
    await page.locator('#stamp-dated').check();
    await page.locator('[data-stamp-design="done_ja"]').click();
    const stamp = (await call('desk_get', { id: 'memo' })).stamp;
    assert.match(stamp.text, /^\d{4}\.\d{2}\.\d{2}$/); assert.ok(stamp.angle <= -3 && stamp.angle >= -9);
    const ink = page.locator('[data-id="memo"] [data-stamp]');
    await page.waitForFunction(() => document.querySelector('[data-id="memo"] [data-stamp]')?.getAttribute('data-compact') === 'true');
    await page.locator('#stamp-menu').click();
    await page.mouse.click(850, 700);
    await page.waitForFunction(() => document.querySelector('[data-id="memo"] [data-stamp]')?.getAttribute('data-compact') === 'false');
    const normal = await ink.getAttribute('transform');
    await call('desk_point', { ids: ['memo'] }); assert.equal(await ink.getAttribute('data-compact'), 'false');
    await call('desk_execute', { operations: [{ kind: 'update', id: 'memo', patch: { width: 700, height: 500 } }] });
    assert.notEqual(await ink.getAttribute('transform'), normal);
    await call('desk_execute', { operations: [{ kind: 'update', id: 'memo', patch: { stamp: { designId: 'future-id', text: '<script>へんてこ</script>', angle: -8 } } }] });
    assert.ok((await ink.textContent())?.includes('<script>へんてこ</script>')); assert.equal(await ink.locator('script').count(), 0);
    await page.locator('[data-id="memo"]').first().click({ position: { x: 100, y: 60 } });
    await page.locator('#stamp-menu').click(); await page.locator('#stamp-clear').click();
    assert.equal((await call('desk_get', { id: 'memo' })).stamp, null);
    await call('desk_undo'); assert.equal((await call('desk_get', { id: 'memo' })).stamp.designId, 'future-id');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
