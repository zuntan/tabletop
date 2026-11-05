import test from 'node:test';
import assert from 'node:assert/strict';
import { openTestDesk } from './desk-browser';

test('local UI language switches without changing the document, camera, selection, or history', { timeout: 45_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('ui-language', undefined, undefined, 'en-US');
  page.setDefaultTimeout(5000);
  const openLanguage = async () => {
    await page.locator('#desk-menu').click();
    await page.locator('#desk-menu-panel > .desk-menu-item').nth(1).click();
  };
  try {
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    assert.equal(await page.locator('#undo').getAttribute('aria-label'), 'Undo');
    assert.equal(await page.locator('#desk-menu').getAttribute('aria-label'), 'Menu');
    assert.equal(await page.locator('#desk-menu svg').count(), 1);
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'note', type: 'text', text: '日本語の本文とEnglish', x: 50, y: 60 } }] });
    await call('desk_select', { ids: ['note'] });
    await call('desk_point', { ids: ['note'] });
    const before = await call('desk_state'), camera = await call('desk_camera_get');
    const selection = await call('desk_selection'), changes = await call('desk_changes', { sinceRevision: 0 });
    await openLanguage();
    await page.locator('#ui-language').selectOption('ja');
    await page.waitForFunction(() => document.documentElement.lang === 'ja');
    assert.equal(await page.locator('#undo').getAttribute('aria-label'), '元に戻す');
    assert.equal(await page.locator('#desk-menu').getAttribute('aria-label'), 'メニュー');
    assert.equal(await page.locator('#desk-menu svg').count(), 1);
    assert.equal(await page.locator('#ui-language').inputValue(), 'ja');
    assert.deepEqual(await call('desk_state'), before);
    assert.deepEqual(await call('desk_camera_get'), camera);
    assert.deepEqual(await call('desk_selection'), selection);
    assert.deepEqual(await call('desk_changes', { sinceRevision: 0 }), changes);
    assert.equal(await page.evaluate(() => localStorage.getItem('tabletop.ui.language')), 'ja');

    // Keep an inline draft open: rejecting a switch must not commit or discard it.
    await page.keyboard.press('Escape');
    await page.locator('[data-id="note"]').dblclick();
    await page.locator('.inline-editor textarea').fill('Unsaved draft');
    await openLanguage();
    await page.locator('#ui-language').selectOption('en');
    assert.equal(await page.locator('#ui-language').inputValue(), 'ja');
    assert.equal(await page.locator('.inline-editor textarea').inputValue(), 'Unsaved draft');
    assert.deepEqual(await call('desk_state'), before);
    assert.match(await page.locator('#desk-menu-panel [role="status"]').textContent() ?? '', /操作/);
    await page.keyboard.press('Escape');
    await page.locator('.inline-editor textarea').focus();
    await page.keyboard.press('Escape');
    await openLanguage();
    await page.locator('#ui-language').selectOption('en');
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    assert.deepEqual(await call('desk_state'), before);
    assert.deepEqual(await call('desk_camera_get'), camera);
    const afterEditing = await call('desk_selection');
    // Double-clicking the card moves the human pointer, independently of language switching.
    assert.deepEqual(afterEditing.ids, selection.ids);
    assert.deepEqual(afterEditing.aiPointing, selection.aiPointing);
    await page.keyboard.press('Escape');
    await page.reload();
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    assert.equal(await page.locator('#undo').getAttribute('aria-label'), 'Undo');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('language switching still works when browser preference storage is unavailable', { timeout: 30_000 }, async () => {
  const { page, close, errors } = await openTestDesk('ui-language-no-storage', `
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
  `);
  try {
    assert.equal(await page.locator('html').getAttribute('lang'), 'ja');
    await page.locator('#desk-menu').click();
    await page.locator('#desk-menu-panel > .desk-menu-item').nth(1).click();
    await page.locator('#ui-language').selectOption('en');
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    assert.equal(await page.locator('#undo').getAttribute('aria-label'), 'Undo');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('English file dialogs cancel without changing the desk and follow a later language switch', { timeout: 30_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('ui-language-files', undefined, undefined, 'en-US');
  try {
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'kept', type: 'text', text: '保存する本文' } }] });
    const before = await call('desk_state');
    await page.getByRole('button', { name: 'File', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Save as', exact: true }).click();
    await page.getByRole('textbox', { name: 'Desk file path', exact: true }).fill('/tmp/should-not-save.tabletop');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.deepEqual(await call('desk_state'), before);
    await page.locator('#desk-menu').click();
    await page.locator('#desk-menu-panel > .desk-menu-item').nth(1).click();
    await page.locator('#ui-language').selectOption('ja');
    await page.waitForFunction(() => document.documentElement.lang === 'ja');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'ファイル', exact: true }).click();
    await page.getByRole('menuitem', { name: 'SAVE AS（名前を付けて保存）', exact: true }).click();
    await page.getByRole('textbox', { name: '机ファイルのパス', exact: true }).waitFor();
    await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
    assert.deepEqual(await call('desk_state'), before);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('color palette and style labels follow the local language without repainting the selection', { timeout: 30_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('ui-language-paint', undefined, undefined, 'en-US');
  page.setDefaultTimeout(5000);
  try {
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'paint', type: 'text', text: 'Keep this text', fill: '#ffeecc' } }] });
    await call('desk_select', { ids: ['paint'] });
    const before = await call('desk_state');
    await page.locator('[data-color-role="fill"]').click();
    const palette = page.locator('.palette-fill');
    await palette.getByRole('button', { name: 'All colors', exact: true }).click();
    await palette.getByRole('button', { name: 'Transparent (none)', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await page.locator('#desk-menu').click();
    await page.locator('#desk-menu-panel > .desk-menu-item').nth(1).click();
    await page.locator('#ui-language').selectOption('ja');
    await page.waitForFunction(() => document.documentElement.lang === 'ja');
    await page.keyboard.press('Escape');
    await call('desk_select', { ids: ['paint'] });
    await page.locator('[data-color-role="fill"]').click();
    await palette.getByRole('button', { name: '全色', exact: true }).waitFor();
    await palette.getByRole('button', { name: '透明（なし）', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#format-capture-0').textContent(), 'スポイト');
    await call('desk_select', { ids: ['paint'] });
    assert.deepEqual(await call('desk_state'), before);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('new pin series use the creation language while existing series names survive switching', { timeout: 30_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('ui-language-series', undefined, undefined, 'en-US');
  page.setDefaultTimeout(5000);
  try {
    await page.locator('#pin-series-menu').click();
    await page.getByRole('button', { name: 'New series + one pin', exact: true }).click();
    const before = await call('desk_state');
    assert.equal(before.settings.series.at(-1).name, 'Series 2');
    assert.equal(await page.locator('#series-fit').textContent(), 'Fit frame to text');
    await page.locator('#desk-menu').click();
    await page.locator('#desk-menu-panel > .desk-menu-item').nth(1).click();
    await page.locator('#ui-language').selectOption('ja');
    await page.waitForFunction(() => document.documentElement.lang === 'ja');
    assert.equal(await page.locator('#series-fit').textContent(), '枠を文字にあわせる');
    assert.deepEqual(await call('desk_state'), before);
    assert.equal(await page.locator('#series-settings [name="name"]').inputValue(), 'Series 2');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('localized stationery explains Japanese artwork and preserves badge data when switching languages', { timeout: 40_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('ui-language-badges', undefined, undefined, 'en-US');
  page.setDefaultTimeout(5000);
  try {
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'note', type: 'text', text: '日本語の本文', x: 100, y: 100 } }] });
    await call('desk_select', { ids: ['note'] });
    await page.locator('#stamp-menu').click();
    const stamp = page.locator('[data-stamp-design="done_ja"]');
    assert.equal(await stamp.getAttribute('aria-label'), 'Apply 済 — Completed stamp');
    assert.match(await stamp.locator('svg').textContent() ?? '', /済/);
    await stamp.click();
    await page.locator('#stamp-menu').click();
    await page.locator('#sticker-menu').click();
    await page.locator('#sticker-shape-menu').click();
    const choices = page.locator('#sticker-choice-palette');
    await choices.getByRole('tab', { name: 'Shapes', exact: true }).click();
    await choices.getByRole('button', { name: 'Heart', exact: true }).click();
    await page.locator('#sticker-shape-menu').click();
    await page.locator('#sticker-add').click();
    await page.locator('#sticker-menu').click();
    await page.locator('#reaction-more').click();
    await page.locator('[data-reaction="✔"]').click();
    await page.locator('#reaction-more').click();
    await page.locator('#reaction-placement-menu').click();
    const placements = page.locator('.reaction-placement-palette:popover-open');
    assert.equal(await placements.locator('button svg').count(), 8);
    await placements.getByRole('button', { name: 'Top left→', exact: true }).click();
    const before = await call('desk_state');
    const note = await call('desk_get', { id: 'note' });
    assert.equal(note.stamp.designId, 'done_ja');
    assert.equal(note.stickers.items[0].shape, 'heart');
    assert.deepEqual(note.reactions, ['✔']);
    await page.locator('#desk-menu').click();
    await page.locator('#desk-menu-panel > .desk-menu-item').nth(1).click();
    await page.locator('#ui-language').selectOption('ja');
    await page.waitForFunction(() => document.documentElement.lang === 'ja');
    assert.equal(await stamp.getAttribute('aria-label'), '済を押す');
    assert.equal(await page.locator('[data-reaction="✔"]').getAttribute('aria-label'), '✔ チェック');
    assert.deepEqual(await call('desk_state'), before);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('English editing controls and connection display preserve drafts and local state', { timeout: 35_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('ui-language-editing', undefined, undefined, 'en-US');
  page.setDefaultTimeout(5000);
  try {
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'note', type: 'text', text: '本文', x: 100, y: 100 } }] });
    await page.locator('[data-id="note"]').dblclick();
    await page.locator('.inline-editor').getByRole('textbox', { name: 'Text', exact: true }).fill('Uncommitted text');
    await page.getByRole('button', { name: 'Markdown preview', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Enter inserts a new line', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    const before = await call('desk_state');
    await page.getByRole('tab', { name: 'AI', exact: true }).click();
    await page.locator('#connection-url').fill('https://example.invalid/');
    await page.getByRole('button', { name: 'Show URL', exact: true }).click();
    await page.locator('#desk-bell-options').click();
    await page.getByRole('textbox', { name: 'Bell note', exact: true }).fill('Keep this bell draft');
    await page.getByRole('button', { name: 'Keep the note and close', exact: true }).click();
    await page.locator('#desk-menu').click();
    await page.locator('#desk-menu-panel > .desk-menu-item').nth(1).click();
    await page.locator('#ui-language').selectOption('ja');
    await page.waitForFunction(() => document.documentElement.lang === 'ja');
    assert.equal(await page.locator('#connection-url').inputValue(), 'https://example.invalid/');
    assert.equal(await page.locator('#connection-url').getAttribute('type'), 'text');
    assert.equal(await page.locator('#connection-show').getAttribute('aria-label'), 'URLを隠す');
    await page.locator('#desk-menu').click();
    await page.locator('#desk-bell-options').click();
    assert.equal(await page.getByRole('textbox', { name: 'ベルに添える文章', exact: true }).inputValue(), 'Keep this bell draft');
    assert.deepEqual(await call('desk_state'), before);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('creation uses the current language and QR fallback refreshes without changing stored content', { timeout: 40_000 }, async () => {
 const {page,call,close,errors}=await openTestDesk('ui-language-creation',undefined,undefined,'en-US');
 page.setDefaultTimeout(5000);
 try {
  assert.equal((await call('desk_settings')).series[0].name,'Numbers');
  await page.locator('#doodle-create').click();
  const doodle=(await call('desk_state')).objects.find((object:any)=>object.doodle);
  assert.equal(doodle.text,'Doodle');
  await page.locator('[data-add="mermaid"]').click();
  const source=await page.getByRole('textbox',{name:'Mermaid source',exact:true}).inputValue();
  assert.match(source,/A\[Start\]/);await page.keyboard.press('Control+Enter');
  const input='あ'.repeat(1000);
  await call('desk_execute',{operations:[{kind:'add',object:{id:'overflow',type:'qrcode',qrText:input,text:'元の題名',x:100,y:100}}]});
  await page.locator('[data-id="overflow"][data-qr-status="too-long"]').waitFor();
  assert.match((await call('desk_asset_read',{id:'overflow'})).svg,/>Too long<\/text>/);
  const [popup]=await Promise.all([page.waitForEvent('popup'),page.locator('[data-open-media="overflow"]').click()]);
  await popup.waitForFunction(()=>document.querySelector('img')?.complete&&document.querySelector('img')!.naturalWidth>0);
  assert.equal(await popup.locator('html').getAttribute('lang'),'en');
  assert.match(decodeURIComponent((await popup.locator('img').getAttribute('src'))!.split(',')[1]),/>Too long<\/text>/);
  await popup.close();
  const before=await call('desk_state');
  await page.locator('#desk-menu').click();await page.locator('#desk-menu-panel > .desk-menu-item').nth(1).click();await page.locator('#ui-language').selectOption('ja');
  await page.waitForFunction(()=>document.documentElement.lang==='ja');
  await page.waitForFunction(()=>decodeURIComponent(document.querySelector('[data-id="overflow"] .qr-image')!.getAttribute('href')??'').includes('長すぎます'));
  assert.match((await call('desk_asset_read',{id:'overflow'})).svg,/>長すぎます<\/text>/);
  assert.deepEqual(await call('desk_state'),before);
  assert.equal((await call('desk_get',{id:'overflow'})).qrText,input);
  assert.equal((await call('desk_settings')).series[0].name,'Numbers');
  assert.deepEqual(errors,[]);
 }finally{await close();}
});

test('camera, deletion and pin navigation labels switch without editing the selected objects', {timeout:35_000}, async()=>{
 const {page,call,close,errors}=await openTestDesk('ui-language-actions',undefined,undefined,'en-US');page.setDefaultTimeout(5000);
 try{
  await call('desk_execute',{operations:[{kind:'add',object:{id:'note',type:'text',text:'Keep me',x:100,y:100}},{kind:'label_add',id:'p1',seriesId:'series-1',x:100,y:400},{kind:'label_add',id:'p2',seriesId:'series-1',x:600,y:400}]});
  await call('desk_select',{ids:['note']});
  const before=await call('desk_state');
  await page.locator('#camera-capture').click();
  await page.getByRole('dialog',{name:'Camera capture area',exact:true}).waitFor();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.locator('#delete-style').click();
  await page.getByRole('menuitemradio',{name:'Delete with Eraser',exact:true}).waitFor();
  await page.locator('#delete-style').click();
  await page.locator('#line-input-open').click();
  await page.getByRole('menuitem',{name:'Connected lines',exact:true}).waitFor();
  await page.locator('#line-input-open').click();
  assert.deepEqual(await call('desk_state'),before);
  await call('desk_select',{ids:['p1']});
  await page.getByRole('button',{name:'Go to next pin',exact:true}).waitFor();
  const pins=await call('desk_state');
  await page.locator('#desk-menu').click();await page.locator('#desk-menu-panel > .desk-menu-item').nth(1).click();await page.locator('#ui-language').selectOption('ja');
  await page.waitForFunction(()=>document.documentElement.lang==='ja');
  assert.equal(await page.locator('#pin-navigation [data-direction="next"]').getAttribute('aria-label'),'次のピンへ移動');
  assert.equal(await page.locator('#delete-eraser').textContent(),'まるっと消しゴムで削除');
  assert.deepEqual(await call('desk_state'),pins);assert.deepEqual(errors,[]);
 }finally{await close();}
});

test('English copy notices and standalone status survive language switching', {timeout:35_000}, async()=>{
 const {page,call,close,errors,port}=await openTestDesk('ui-language-notices',undefined,undefined,'en-US');page.setDefaultTimeout(5000);
 try{
  await call('desk_execute',{operations:[{kind:'add',object:{id:'note',type:'text',text:'Keep',x:100,y:100}}]});await call('desk_select',{ids:['note']});
  const before=await call('desk_state');
  await page.evaluate(()=>document.querySelector('#canvas')!.dispatchEvent(new ClipboardEvent('copy',{bubbles:true,cancelable:true,clipboardData:new DataTransfer()})));
  assert.equal(await page.locator('#message').textContent(),'Copied 1 item');
  assert.deepEqual(await call('desk_state'),before);
  const standalone=await page.context().browser()!.newPage({locale:'en-US'});standalone.on('pageerror',error=>errors.push(error.message));
  try{
   await standalone.goto(`http://127.0.0.1:${port}/?connect=off`);
   await standalone.waitForFunction(()=>document.querySelector('#connection')?.textContent==='No AI connection (standalone desk)');
   await standalone.locator('#desk-menu').click();await standalone.locator('#desk-menu-panel > .desk-menu-item').nth(1).click();await standalone.locator('#ui-language').selectOption('ja');
   await standalone.waitForFunction(()=>document.documentElement.lang==='ja');
   assert.equal(await standalone.locator('#connection').textContent(),'AI未接続（単独の机）');
   assert.match(await standalone.locator('#connection-detail').textContent()??'',/アップロード／ダウンロード/);
   assert.deepEqual(await call('desk_state'),before);
  }finally{await standalone.close();}
  assert.deepEqual(errors,[]);
 }finally{await close();}
});
