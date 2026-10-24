import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openTestDesk} from './desk-browser';

test('world-zero guides have fixed screen width, avoid empty text, stay below parts and persist with Undo',{timeout:30_000},async()=>{
 const{page,call,close,errors}=await openTestDesk('origin-guides');
 try{
  assert.equal(await page.locator('#origin-guides').getAttribute('display'),'none');
  await page.locator('#desk-menu').click();await page.getByRole('button',{name:'机の見た目…'}).click();
  await page.getByRole('checkbox',{name:'原点の縦横線を表示',exact:true}).check();
  const color=page.getByLabel('原点軸の色',{exact:true});await color.evaluate((node:HTMLInputElement)=>{node.value='#ad3456';node.dispatchEvent(new Event('change',{bubbles:true}));});await page.keyboard.press('Escape');
  assert.equal(await page.locator('#origin-guides path').getAttribute('stroke'),'#ad3456');
  assert.equal(await page.locator('#origin-guides path').getAttribute('stroke-width'),'2');
  assert.equal(await page.locator('#origin-guides').getAttribute('pointer-events'),'none');
  assert.equal(await page.locator('#origin-guide-mask rect').last().getAttribute('display'),'inline');
  assert.equal(await page.locator('#origin-guides').evaluate(n=>Boolean(n.compareDocumentPosition(document.querySelector('#viewport')!)&Node.DOCUMENT_POSITION_FOLLOWING)),true);
  const settings=(await call('desk_settings')).background;assert.equal(settings.originAxes,true);assert.equal(settings.originAxesColor,'#ad3456');
  for(const zoom of [.25,3]){
   await call('desk_camera_move',{center:{x:0,y:0},zoom,durationMs:0});
   const geometry=await page.locator('#origin-guides path').evaluate(n=>{const svg=(n as SVGElement).ownerSVGElement!;return{path:n.getAttribute('d'),width:getComputedStyle(n).strokeWidth,w:svg.clientWidth,h:svg.clientHeight};});
   assert.equal(geometry.width,'2px');assert.equal(geometry.path,`M 0 ${geometry.h/2} H ${geometry.w} M ${geometry.w/2} 0 V ${geometry.h}`);
  }
  await page.screenshot({path:'/tmp/tabletop-origin-guides.png'});
  const mask=await page.locator('#origin-guide-mask rect').last().evaluate(n=>({x:Number(n.getAttribute('x')),y:Number(n.getAttribute('y')),width:Number(n.getAttribute('width')),height:Number(n.getAttribute('height'))}));
  assert.ok(mask.width>200);assert.ok(mask.width<(await page.locator('#canvas').boundingBox())!.width);
  await call('desk_execute',{operations:[{kind:'background_update',patch:{wallpaper:'wood'}}]});await page.screenshot({path:'/tmp/tabletop-origin-guides-wood.png'});await call('desk_undo');
  await call('desk_execute',{operations:[{kind:'add',object:{id:'one',type:'text',text:'one'}}]});
  assert.equal(await page.locator('#origin-guide-mask rect').last().getAttribute('display'),'none');
  await call('desk_undo');assert.equal(await page.locator('#origin-guide-mask rect').last().getAttribute('display'),'inline');
  await page.setViewportSize({width:1000,height:850});await page.waitForFunction(()=>Number(document.querySelector('#origin-guide-mask')?.getAttribute('width'))===document.querySelector('#canvas')?.clientWidth);
  await call('desk_execute',{operations:[{kind:'background_update',patch:{originAxes:false}}]});assert.equal(await page.locator('#origin-guides').getAttribute('display'),'none');
  await call('desk_undo');assert.equal(await page.locator('#origin-guides').getAttribute('display'),'inline');
  const file=await call('desk_save',{filename:`origin-${Date.now()}.tabletop`});
  const now=await call('desk_summary');await call('desk_load',{filename:file.filename,confirm:true,expectedSessionId:now.sessionId,expectedRevision:now.revision});
  assert.deepEqual((await call('desk_settings')).background,settings);assert.equal(await page.locator('#origin-guides path').getAttribute('stroke'),'#ad3456');
  assert.deepEqual(errors,[]);
 }finally{await close();}
});
