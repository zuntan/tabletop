import {callTestTool} from './mcp-call';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDesk } from './desk-browser';
test('human palette and AI read-only preset IF place embedded props, including custom SVGs, without open controls', { timeout: 60_000 }, async () => {
  const { page, call, client, close, errors } = await openTestDesk('props');
  try {
    const catalog = await call('desk_prop_list'); assert.equal(catalog.presets.length, 15);
    for (const item of catalog.presets) {
      const source = await call('desk_prop_get', { id: item.id }); assert.match(source.svg, /<svg/);
    }
    const preset = await call('desk_prop_get', { id: 'teacup' }); assert.match(preset.svg, /<svg/);
    const bad = await callTestTool(client, { name: 'desk_prop_get', arguments: { id: '../server.ts' } }); assert.equal(bad.isError, true);
    assert.equal(await page.locator('#prop-palette img').count(), 15);
    await page.locator('#prop-palette img').evaluateAll(images => Promise.all(images.map(image => (image as HTMLImageElement).decode())));
    const before = await call('desk_summary');
    await page.locator('#prop-open').click(); await page.locator('[data-prop-preset="senpai-robot"]').click();
    await page.locator('[data-id^="prop-"]').first().waitFor();
    const state = await call('desk_state'); const prop = state.objects.find((o: {type:string}) => o.type === 'prop'); assert.ok(prop);
    assert.equal(prop.text,'ロボット');
    assert.equal(state.revision, before.revision + 1); assert.match(prop.src, /^data:image\/svg\+xml;base64,/);
    assert.equal(await page.locator(`[data-id="${prop.id}"] image`).count(), 1);
    assert.equal(await page.locator(`[data-id="${prop.id}"] [data-prop-body]`).getAttribute('fill'), 'transparent');
    assert.equal(await page.locator(`[data-id="${prop.id}"] [data-prop-title]`).getAttribute('fill'), '#ffffff');
    assert.equal(await page.locator(`[data-id="${prop.id}"] [data-prop-title]`).getAttribute('height'), '34');
    await page.locator('#prop-open').click();
    const hit = await page.locator(`[data-id="${prop.id}"]`).evaluate(el => {
      const p = new DOMPoint(4, 50).matrixTransform((el as unknown as SVGGraphicsElement).getScreenCTM()!);
      return document.elementFromPoint(p.x,p.y)?.closest('[data-id]')?.getAttribute('data-id');
    });
    assert.equal(hit, prop.id);
    assert.equal(await page.locator(`[data-id="${prop.id}"] [data-open-url], [data-id="${prop.id}"] [data-open-media]`).count(), 0);
    const custom = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="blue"/></svg>';
    await call('desk_asset_import', { id: 'custom', asProp: true, source: { svg: custom }, x: 600, y: 200 });
    assert.equal((await call('desk_get', { id: 'custom' })).type, 'prop');
    assert.equal((await call('desk_asset_read', { id: 'custom' })).svg, custom);
    await call('desk_asset_import', { id: 'custom', mode: 'replace', source: { svg: preset.svg } });
    assert.equal((await call('desk_get', { id: 'custom' })).type, 'prop');
    const illegal = await callTestTool(client, { name: 'desk_asset_import', arguments: { id: 'bad-prop', asProp: true, source: { svg: custom }, url: 'https://example.com' } });
    assert.equal(illegal.isError, true);
    await call('desk_undo'); assert.equal((await call('desk_asset_read', { id: 'custom' })).svg, custom);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('prop catalog stays English while UI names follow creation language without changing placed artwork', {timeout:45000}, async () => {
  const {page,call,close,errors}=await openTestDesk('props-language',undefined,undefined,'en-US');
  try {
    const catalog=await call('desk_prop_list');
    assert.equal(catalog.presets.find((p:any)=>p.id==='teacup').name,'Tea cup');
    const preset=await call('desk_prop_get',{id:'temporary-area'});
    assert.equal(preset.name,'Temporary area');
    assert.match(preset.description,/Japanese sign/);
    await page.locator('#prop-open').click();
    assert.equal(await page.locator('#prop-open').getAttribute('aria-label'),'Props');
    assert.equal(await page.locator('[data-prop-preset="temporary-area"] .prop-caption').textContent(),'Temporary\narea JP');
    await page.locator('#prop-palette').screenshot({path:'/tmp/tabletop-v011-props-en.png'});
    await page.locator('[data-prop-preset="senpai-robot"]').click();
    await page.locator('[data-id^="prop-"]').first().waitFor();
    const placed=await call('desk_state');
    const robot=placed.objects.find((p:any)=>p.type==='prop');
    assert.equal(robot.text,'Robot');
    await page.keyboard.press('Escape');
    const before=await call('desk_state');
    await page.locator('#desk-menu').click();
    await page.locator('#desk-menu-panel > .desk-menu-item').nth(1).click();
    await page.locator('#ui-language').selectOption('ja');
    await page.waitForFunction(()=>document.documentElement.lang==='ja');
    assert.deepEqual(await call('desk_state'),before);
    assert.equal(await page.locator('#prop-open').getAttribute('aria-label'),'小物一覧');
    await page.keyboard.press('Escape');
    await page.locator('#prop-open').click();
    assert.equal(await page.locator('[data-prop-preset="temporary-area"] .prop-caption').textContent(),'仮置き場');
    await page.locator('[data-prop-preset="teacup"]').click();
    await page.waitForFunction(()=>document.querySelectorAll('[data-id^="prop-"]').length===2);
    const after=await call('desk_state');
    assert.equal(after.objects.find((p:any)=>p.type==='prop'&&p.id!==robot.id).text,'ひと息の湯呑み');
    assert.deepEqual(after.objects.find((p:any)=>p.id===robot.id),robot);
    assert.deepEqual(await call('desk_prop_list'),catalog);
    assert.deepEqual(await call('desk_prop_get',{id:'temporary-area'}),preset);
    assert.deepEqual(errors,[]);
  } finally {await close();}
});
