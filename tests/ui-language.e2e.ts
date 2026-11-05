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

test('automatic launch names use the initial language and explicit names stay literal', {timeout:35_000}, async()=>{
 const {page,call,close,errors,port}=await openTestDesk('ui-language-launch',undefined,undefined,'en-US');
 const browser=page.context().browser()!;const ja=await browser.newPage({locale:'ja-JP'}),en=await browser.newPage({locale:'en-US'});
 for(const tab of [ja,en]){tab.setDefaultTimeout(5000);tab.on('pageerror',error=>errors.push(error.message));}
 try{
  const before=await call('desk_state');
  await ja.goto(`http://127.0.0.1:${port}/?connect=off&newDeskName=Untitled(2)&newDeskNameAuto=1`);
  await ja.waitForFunction(()=>document.querySelector('#desk-name')?.textContent==='無題(2)');
  assert.equal(new URL(ja.url()).searchParams.has('newDeskName'),false);assert.equal(new URL(ja.url()).searchParams.has('newDeskNameAuto'),false);
  await ja.locator('#desk-menu').click();await ja.locator('#desk-menu-panel > .desk-menu-item').nth(1).click();await ja.locator('#ui-language').selectOption('en');
  await ja.waitForFunction(()=>document.documentElement.lang==='en');assert.equal(await ja.locator('#desk-name').textContent(),'無題(2)');
  await en.goto(`http://127.0.0.1:${port}/?connect=off&newDeskName=Untitled(3)&newDeskNameAuto=1`);
  await en.waitForFunction(()=>document.querySelector('#desk-name')?.textContent==='Untitled(3)');
  await en.goto(`http://127.0.0.1:${port}/?connect=off&newDeskName=${encodeURIComponent('無題(4)')}`);
  await en.waitForFunction(()=>document.querySelector('#desk-name')?.textContent==='無題(4)');
  assert.deepEqual(await call('desk_state'),before);assert.deepEqual(errors,[]);
 }finally{await ja.close();await en.close();await close();}
});

test('connection diagnostics and released details use the UI language without exposing a URL', {timeout:35_000},async()=>{
 const {page,call,close,errors}=await openTestDesk('ui-language-connection',undefined,undefined,'en-US');page.setDefaultTimeout(5000);
 try{
  await call('desk_execute',{operations:[{kind:'add',object:{id:'kept',type:'text',text:'Stay here',x:100,y:100}}]});
  const before=await call('desk_state');
  await page.getByRole('tab',{name:'AI',exact:true}).click();
  let sockets=0;page.on('websocket',()=>sockets++);
  await page.locator('#connection-url').fill('https://example.invalid/#token=do-not-echo-this');
  await page.getByRole('button',{name:'Connect',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.startsWith('Check the connection URL.'));
  assert.doesNotMatch(await page.locator('#message').textContent()??'',/do-not-echo|example.invalid/);assert.equal(sockets,0);
  assert.deepEqual(await call('desk_state'),before);
  await call('desk_release',{confirm:true});
  await page.waitForFunction(()=>document.querySelector('#connection-detail')?.textContent?.startsWith('The AI connection was released'));
  await page.locator('#desk-menu').click();await page.locator('#desk-menu-panel > .desk-menu-item').nth(1).click();await page.locator('#ui-language').selectOption('ja');
  await page.waitForFunction(()=>document.documentElement.lang==='ja');
  assert.match(await page.locator('#connection-detail').textContent()??'',/^AIとの接続を解放しました/);
  assert.equal((await page.locator('[data-id="kept"] .markdown-text').textContent())?.trim(),'Stay here');assert.equal(sockets,0);assert.deepEqual(errors,[]);
 }finally{await close();}
});

test('object control labels keep user text literal and translated drawing hints do not edit data', {timeout:40_000},async()=>{
 const {page,call,close,errors}=await openTestDesk('ui-language-drawing',undefined,undefined,'en-US');page.setDefaultTimeout(5000);
 try{
  const name='My <b>{{name}}</b> & note';
  const src='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>').toString('base64');
  await call('desk_execute',{operations:[{kind:'add',object:{id:'pic',type:'svg',src,text:name,x:100,y:100}},{kind:'add',object:{id:'desk',type:'link',deskPath:'/tmp/example.tabletop',text:'Example',x:400,y:100}},{kind:'add',object:{id:'paper',type:'text',text:'A',x:100,y:400,width:96,height:80}},{kind:'add',object:{id:'clip',type:'clip',clipMembers:[],clipOffsetMode:'percent',clipOffsetPercent:30,x:700,y:100}}]});
  assert.equal(await page.locator('[data-open-media="pic"]').getAttribute('aria-label'),`Open image in a new tab: ${name}`);
  assert.equal(await page.locator('[data-open-desk="desk"]').getAttribute('aria-label'),'Open desk: Example');
  await call('desk_select',{ids:['paper']});await page.locator('#file-create').click();
  const file=(await call('desk_state')).objects.find((object:any)=>object.type==='file');assert.equal(file.text,'Clear folder');
  await call('desk_execute',{operations:[{kind:'update',id:file.id,patch:{text:''}}]});
  const title=page.locator(`[data-id="${file.id}"] [data-file-title]`);assert.equal(await title.textContent(),'Clear folder');assert.notEqual(await title.getAttribute('textLength'),null);
  await call('desk_select',{ids:[]});await page.locator('#ruler-create').click();
  const ruler=(await call('desk_state')).objects.find((object:any)=>object.type==='ruler');assert.equal(ruler.text,'Ruler');
  await call('desk_execute',{operations:[{kind:'update',id:ruler.id,patch:{rulerMode:'center',rulerMaterial:'bamboo'}}]});
  const rulerTitle=page.locator(`[data-id="${ruler.id}"] [data-ruler-body] > title`);assert.equal(await rulerTitle.textContent(),'Ruler: Equal centers · Bamboo · 0 cards');
  const before=await call('desk_state');
  await page.locator('#desk-menu').click();await page.locator('#desk-menu-panel > .desk-menu-item').nth(1).click();await page.locator('#ui-language').selectOption('ja');await page.waitForFunction(()=>document.documentElement.lang==='ja');
  assert.equal(await page.locator('[data-open-media="pic"]').getAttribute('aria-label'),`画像を別タブで開く：${name}`);
  assert.equal(await page.locator('[data-open-media="pic"] b').count(),0);
  assert.equal(await page.locator('[data-open-desk="desk"]').getAttribute('aria-label'),'机を開く：Example');
  assert.equal(await rulerTitle.textContent(),'定規：中心均等・竹・0枚');
  assert.equal(await title.textContent(),'クリアファイル');assert.equal(await title.getAttribute('textLength'),null);
  assert.match(await page.locator('[data-id="clip"] > title').textContent()??'',/クリップ：0枚 · 間隔 30%（直前の紙）/);
  assert.deepEqual(await call('desk_state'),before);assert.deepEqual(errors,[]);
 }finally{await close();}
});
