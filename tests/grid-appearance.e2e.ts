import test from 'node:test';
import assert from 'node:assert/strict';
import {openTestDesk} from './desk-browser';

test('grid interval presets and visibility are independent of snapping and preserve existing positions',{timeout:30000},async()=>{
 const desk=await openTestDesk('grid-appearance');const {page,call}=desk;
 try{
  await call('desk_execute',{operations:[{kind:'add',object:{id:'note',type:'text',x:13,y:17,text:'keep'}}]});const before=await call('desk_get',{id:'note'});
  await page.locator('#desk-menu').click();await page.getByRole('button',{name:'机の見た目…',exact:true}).click();
  const interval=page.getByRole('spinbutton',{name:'グリッド間隔',exact:true}),visible=page.getByRole('checkbox',{name:'スナップグリッドを表示',exact:true});
  await page.getByLabel('スナップグリッドの色',{exact:true}).fill('#112233');await page.getByLabel('スナップグリッドの色',{exact:true}).dispatchEvent('change');
  await page.getByLabel('原点軸の色',{exact:true}).fill('#aabbcc');await page.getByLabel('原点軸の色',{exact:true}).dispatchEvent('change');
  await page.getByLabel('スナップグリッドの形',{exact:true}).selectOption('lines');assert.equal(await page.locator('#dots path').getAttribute('display'),'inline');assert.equal(await page.locator('#dots path').getAttribute('stroke'),'#112233');assert.equal((await call('desk_settings')).background.originAxesColor,'#aabbcc');
  await page.getByLabel('スナップグリッドの形',{exact:true}).selectOption('dots');assert.equal(await page.locator('#dots circle').getAttribute('display'),'inline');assert.equal(await page.locator('#dots circle').getAttribute('fill'),'#112233');
  await page.getByLabel('スナップグリッドの形',{exact:true}).selectOption('both');assert.equal(await page.locator('#dots circle').getAttribute('display'),'inline');assert.equal(await page.locator('#dots path').getAttribute('display'),'inline');
  const row=page.locator('.desk-menu-grid-controls');assert.equal(await row.evaluate(e=>new Set([...e.children].map(n=>Math.round(n.getBoundingClientRect().top+n.getBoundingClientRect().height/2))).size),1);
  assert.equal(await interval.inputValue(),'96');assert.equal(await visible.isChecked(),true);
  await page.getByRole('button',{name:'グリッド間隔の候補',exact:true}).click();const palette=page.getByRole('dialog',{name:'グリッド間隔の候補',exact:true});assert.deepEqual(await palette.locator('button').allTextContents(),['24','48','72','96','120','144','168','192','216','240']);await palette.getByRole('button',{name:'72',exact:true}).click();
  assert.equal((await call('desk_settings')).grid.interval,72);assert.equal(await page.locator('#dots').getAttribute('width'),'72');
  await visible.uncheck();assert.equal((await call('desk_settings')).grid.enabled,true);assert.equal(await page.locator('#desk-grid').getAttribute('visibility'),'hidden');
  await page.keyboard.press('Escape');await page.locator('#grid-snap').click();await page.locator('#desk-menu').click();await page.getByRole('button',{name:'机の見た目…',exact:true}).click();await visible.check();assert.equal((await call('desk_settings')).grid.enabled,false);assert.equal(await page.locator('#desk-grid').getAttribute('visibility'),'visible');
  await interval.fill('37.5');await interval.dispatchEvent('change');assert.equal((await call('desk_settings')).grid.interval,37.5);assert.deepEqual(await call('desk_get',{id:'note'}),before);
  await call('desk_undo');assert.equal(await interval.inputValue(),'72');await call('desk_redo');assert.equal(await interval.inputValue(),'37.5');
  for(const name of ['選択枠の色','AIの指差し枠の色','タイトル背景色','原点軸の色']){assert.equal(await page.getByLabel(name,{exact:true}).evaluate(node=>getComputedStyle(node.closest('.desk-menu-field')!).gridTemplateColumns.split(' ').length),2);}
  assert.equal(await page.locator('#clear-ai-pointing .tool-caption').textContent(),'AI指差し\n解除');assert.equal(await page.locator('#clear-ai-pointing .tool-caption').evaluate(e=>getComputedStyle(e).whiteSpace),'pre-line');
  await page.getByRole('button',{name:'スナップ間隔の候補',exact:true}).click();const divisions=page.getByRole('dialog',{name:'スナップ間隔の候補',exact:true});assert.deepEqual(await divisions.locator('button').allTextContents(),['1:1','2:1','3:1','4:1']);await divisions.getByRole('button',{name:'2:1',exact:true}).click();
  assert.equal((await call('desk_settings')).grid.snapDivisions,2);assert.equal(await page.locator('#dots').getAttribute('width'),'37.5');assert.deepEqual(await call('desk_get',{id:'note'}),before);
  await call('desk_undo');assert.equal((await call('desk_settings')).grid.snapDivisions,4);assert.equal(await page.getByRole('button',{name:'スナップ間隔の候補',exact:true}).textContent(),'4:1');
  assert.deepEqual(desk.errors,[]);
 }finally{await desk.close();}
});
