import assert from 'node:assert/strict';
import { test } from 'node:test';
import {mkdir,readFile} from 'node:fs/promises';
import { openTestDesk } from './desk-browser';

test('desk menu edits shared appearance, previews opacity once per gesture, follows Undo and stays independent of UI theme', { timeout: 30_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('desk-menu');
  try {
    const menu = page.getByRole('button', { name: 'メニュー', exact: true });
    assert.equal(await page.locator('#file-menu + #desk-menu').count(), 1);
    await menu.click();
    await page.getByRole('button', { name: '机の見た目…' }).click();
    await page.getByRole('combobox', { name: '壁紙', exact: true }).selectOption('cutting-mat');
    const before = await call('desk_state'), camera = await call('desk_camera_get');
    const range = page.getByRole('slider', { name: '壁紙の不透明度' });
    await range.evaluate((node: HTMLInputElement) => { node.value = '40'; node.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal(await page.locator('#desk-surface').getAttribute('opacity'), '0.4');
    assert.equal((await call('desk_state')).revision, before.revision);
    await range.dispatchEvent('change');
    assert.equal((await call('desk_state')).revision, before.revision + 1);
    await call('desk_undo');
    assert.equal(await range.inputValue(), '100');
    assert.equal(await page.locator('#desk-surface').getAttribute('opacity'), '1');
    await range.evaluate((node: HTMLInputElement) => { node.value = '0'; node.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#desk-surface').getAttribute('opacity'), '1');
    await menu.click(); await page.getByRole('button', { name: '机の見た目…' }).click();
    const brightness = page.getByRole('slider', { name: '下地の明るさ' });
    assert.equal(await brightness.getAttribute('dir'), 'rtl');
    for (const [value, fill] of [['100', '#ffffff'], ['0', '#000000'], ['50', '#808080']]) {
      await brightness.evaluate((node: HTMLInputElement, value) => { node.value = value; node.dispatchEvent(new Event('input', { bubbles: true })); }, value);
      assert.equal(await page.locator('#desk-underlay').getAttribute('fill'), fill);
      await brightness.dispatchEvent('change');
      assert.equal((await call('desk_context')).settings.background.underlayBrightness, Number(value) / 100);
    }
    await call('desk_undo');
    assert.equal(await brightness.inputValue(), '0');
    await call('desk_redo');
    assert.equal(await brightness.inputValue(), '50');
    const color = page.getByLabel('選択枠の色', { exact: true });
    await color.fill('#ff0000'); await color.dispatchEvent('change');
    assert.equal((await call('desk_context')).settings.background.selectionColor, '#ff0000');
    await page.getByRole('checkbox', { name: '選択枠を壁紙に合わせる', exact: true }).check();
    assert.equal((await call('desk_context')).settings.background.selectionColor, null);
    await call('desk_ui_set', { theme: 'dark' });
    assert.equal(await page.locator('#desk-menu-panel').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(32, 41, 54)');
    await page.keyboard.press('Escape');
    await menu.click(); await page.getByRole('button', { name: 'Tabletopについて…' }).click();
    const version=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version;
    assert.equal(await page.getByRole('link',{name:`Tabletop ${version}`,exact:true}).getAttribute('href'),'https://github.com/zuntan/tabletop/releases');
    assert.equal(await page.getByRole('link', { name: 'プロジェクト → GitHub Repository' }).getAttribute('href'), 'https://github.com/zuntan/tabletop');
    assert.deepEqual(await page.locator('.about-credits dt').allTextContents(),['プログラマー','アドバイザー','企画・ディレクション']);
    assert.deepEqual(await page.locator('.about-credits dd').allTextContents(),['センパイ（GPT Sol 6.1 ～）','おっさん〈だらっくだ〉（ChatGPT GPT 6 ～）','ずんたん〈zuntan〉']);
    assert.equal(await page.locator('.about-credits a').count(),0);assert.equal(await page.locator('.about-links a').count(),2);
    assert.equal(await page.getByRole('link',{name:'MIT License',exact:true}).getAttribute('href'),'https://github.com/zuntan/tabletop/blob/main/LICENSE');
    assert.match(await page.locator('.about-project-license').innerText(),/Copyright © 2026 zuntan/);
    assert.equal(await page.locator('.about-credits + .about-project-links + .about-project-license + .about-links').count(),1);
    assert.deepEqual(await page.locator('.about-project-links a').allTextContents(),['プロジェクト → GitHub Repository','ファンレター・感想 → GitHub Discussions']);
    assert.equal(await page.getByRole('link',{name:'ファンレター・感想 → GitHub Discussions',exact:true}).getAttribute('href'),'https://github.com/zuntan/tabletop/discussions/categories/fan-letters');
    await page.locator('.about-desk-artwork').evaluate((img:HTMLImageElement)=>img.decode());
    await mkdir('tmp/about',{recursive:true});await page.screenshot({path:'tmp/about/dark.png'});
    await call('desk_ui_set',{theme:'light'});await page.screenshot({path:'tmp/about/light.png'});
    await page.setViewportSize({ width: 390, height: 700 });
    const rect = (await page.locator('#desk-menu-panel').boundingBox())!;
    assert.ok(rect.x >= 0 && rect.x + rect.width <= 390);
    await page.screenshot({path:'tmp/about/small.png'});
    assert.deepEqual((await call('desk_state')).objects, before.objects);
    // Viewport size changes camera bounds, but menu interactions do not move its world center.
    const afterCamera = await call('desk_camera_get');
    assert.equal(afterCamera.zoom, camera.zoom);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
