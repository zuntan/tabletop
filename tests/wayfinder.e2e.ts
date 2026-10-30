import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';

test('wayfinder follows an off-screen bent route at fixed zoom, lands at its card and cancels on human input', {timeout:60_000}, async()=>{
  const {page,call,close,errors}=await openTestDesk('wayfinder');
  try{
    await call('desk_execute',{operations:[
      {kind:'add',object:{id:'a',type:'text',x:100,y:300,width:200,height:120,text:'出発'}},
      {kind:'add',object:{id:'b',type:'text',x:3000,y:1500,width:200,height:120,text:'到着'}},
      {kind:'add',object:{id:'go',type:'wayfinder',width:72,height:72,attachment:{objectId:'a',anchor:'right'}}},
      {kind:'add',object:{id:'l1',type:'line',startBinding:{objectId:'go',anchor:'right'},x2:2000,y2:324,endJunction:'j1',junctionRounding:60}},
      {kind:'add',object:{id:'l2',type:'line',x:2000,y:324,x2:2000,y2:1560,startJunction:'j1',endJunction:'j2',junctionRounding:60}},
      {kind:'add',object:{id:'l3',type:'line',x:2000,y:1560,startJunction:'j2',endBinding:{objectId:'b',anchor:'left'},junctionRounding:60}},
    ]});
    const before=await call('desk_context'),view=await call('desk_camera_get');
    await page.evaluate(()=>{
      const samples:{x:number;y:number;zoom:number}[]=[];
      const timer=setInterval(()=>{
        const m=(document.querySelector('#viewport') as unknown as SVGGElement).transform.baseVal.consolidate()!.matrix,canvas=document.querySelector('#canvas')!;
        samples.push({x:(canvas.clientWidth/2-m.e)/m.a,y:(canvas.clientHeight/2-m.f)/m.a,zoom:m.a});
      },16);
      (window as unknown as {wayfinderSamples:{samples:typeof samples;timer:ReturnType<typeof setInterval>}}).wayfinderSamples={samples,timer};
    });
    await call('desk_select',{ids:['go']});await page.locator('[data-wayfinder-run="go"]').click();
    await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.includes('到着しました'),null,{timeout:12_000});
    const arrived=await call('desk_camera_get');
    assert.equal(arrived.zoom,view.zoom);assert.deepEqual(arrived.center,{x:3100,y:1560});
    const samples=await page.evaluate(()=>{const s=(window as unknown as {wayfinderSamples:{samples:{x:number;y:number;zoom:number}[];timer:ReturnType<typeof setInterval>}}).wayfinderSamples;clearInterval(s.timer);return s.samples;});
    assert.ok(samples.some(p=>Math.abs(p.x-2000)<2&&p.y>650&&p.y<1300),'camera must follow the vertical leg instead of a diagonal shortcut');
    assert.ok(samples.every(p=>Math.abs(p.zoom-view.zoom)<1e-6),'zoom stays fixed throughout travel');
    assert.equal((await call('desk_context')).revision,before.revision,'travel is not a document edit');
    assert.equal(await page.locator('[data-wayfinder-marker] circle').count(),0);
    await call('desk_camera_move',{center:{x:300,y:324},durationMs:0});
    await call('desk_select',{ids:['go']});await page.locator('[data-wayfinder-run="go"]').click();
    await page.waitForSelector('[data-wayfinder-marker] circle');
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.includes('中止しました'));
    const cancelled=await call('desk_camera_get');
    await page.waitForTimeout(300);
    assert.deepEqual(await call('desk_camera_get'),cancelled);
    assert.equal(await page.locator('[data-wayfinder-marker] circle').count(),0);
    await call('desk_select',{ids:['go']});
    const originalStroke=(await call('desk_get',{id:'go'})).stroke;
    await page.locator('#color-controls [data-color-role="fill"]').click();
    await page.locator('.palette-fill').getByRole('button',{name:'全色',exact:true}).click();
    await page.locator('.palette-fill').getByRole('button',{name:'塗り #f87171',exact:true}).click();
    assert.equal((await call('desk_get',{id:'go'})).fill,'#f87171');
    assert.equal((await call('desk_get',{id:'go'})).stroke,originalStroke);
    assert.equal(await page.locator('#color-controls [data-color-role="stroke"]').isVisible(),false);
    await page.getByRole('button',{name:'観光',exact:true}).click();
    assert.equal((await call('desk_get',{id:'go'})).wayfinderMode,'tour');
    assert.equal(await page.getByRole('button',{name:'観光',exact:true}).getAttribute('aria-pressed'),'true');
    await call('desk_camera_move',{center:{x:300,y:324},durationMs:0});
    await call('desk_select',{ids:['go']});await page.locator('[data-wayfinder-run="go"]').click();
    await page.waitForSelector('[data-wayfinder-marker] circle');
    const speed:number[]=await page.evaluate(`(async()=>{
      const sample=()=>{const m=document.querySelector('#viewport').transform.baseVal.consolidate().matrix;return {x:m.e,y:m.f,t:performance.now()};};
      const a=sample();await new Promise(r=>setTimeout(r,600));const b=sample();await new Promise(r=>setTimeout(r,600));const c=sample();
      return [Math.hypot(b.x-a.x,b.y-a.y)*1000/(b.t-a.t),Math.hypot(c.x-b.x,c.y-b.y)*1000/(c.t-b.t)];
    })()`);
    for(const s of speed)assert.ok(Math.abs(s-120)<10,`tour speed: ${s}`);
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.includes('中止しました'));
    await call('desk_camera_move',{center:{x:300,y:324},durationMs:0});
    const startTime=Date.now(),started=await call('desk_wayfinder_start',{id:'go'});
    assert.equal(started.status,'started');assert.equal(started.mode,'tour');assert.equal(started.id,'go');
    assert.ok(Date.now()-startTime<1500,'start acknowledges without waiting for the long tour');
    await page.waitForSelector('[data-wayfinder-marker] circle');
    assert.equal((await call('desk_get',{id:'go'})).wayfinderMode,'tour','other tools remain usable during travel');
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.includes('中止しました'));
    assert.deepEqual(errors,[]);
  }finally{await close();}
});

test('branch map resumes raw line travel, preserves arrows and consumes outside cancellation', {timeout:60_000}, async()=>{
 const {page,call,close,errors}=await openTestDesk('wayfinder-branch');
 try{
  await call('desk_execute',{operations:[
   {kind:'add',object:{id:'road',type:'line',x:0,y:0,x2:600,y2:0,endJunction:'fork'}},
   {kind:'add',object:{id:'up',type:'line',x:600,y:0,x2:600,y2:-2000,startJunction:'fork',endMarker:'arrow'}},
   {kind:'add',object:{id:'right',type:'line',x:600,y:0,x2:2000,y2:0,startJunction:'fork',startMarker:'arrow'}},
  ]});
  await call('desk_wayfinder_start',{lineId:'road',from:'start'});
  await page.waitForSelector('#wayfinder-map:not([hidden])');
  const waiting=await call('desk_camera_get');assert.equal(waiting.navigation.status,'waiting');assert.equal(waiting.navigation.reason,'branch');assert.equal(waiting.navigation.choices.length,2);
  await page.screenshot({path:'/tmp/tabletop-wayfinder-map.png'});
  assert.equal(await page.locator('#wayfinder-map svg').getAttribute('data-map-scale'),'0.25');
  assert.ok(await page.locator('#wayfinder-map .connector-marker').count()>=2);
  await page.locator('#wayfinder-map [data-line-id="right"]').click();
  await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.includes('線の端に到着'));
  assert.equal((await call('desk_camera_get')).navigation.reason,'line-end');
  await call('desk_wayfinder_start',{lineId:'road',from:'start'});
  await page.waitForSelector('#wayfinder-map:not([hidden])');
  const selectedBefore=await call('desk_selection');
  await page.locator('#canvas').click({position:{x:20,y:20}});
  assert.deepEqual((await call('desk_selection')).ids,selectedBefore.ids);
  await page.waitForSelector('#wayfinder-map[hidden]',{state:'attached'});
  assert.equal((await call('desk_camera_get')).navigation.reason,'human');
  await call('desk_wayfinder_start',{lineId:'road',from:'start'});
  await page.waitForSelector('#wayfinder-map:not([hidden])');
  await call('desk_execute',{operations:[{kind:'update',id:'right',patch:{x2:2100}}]});
  await page.waitForTimeout(500);
  assert.equal((await call('desk_camera_get')).navigation.reason,'changed',await page.locator('#message').textContent()??'');
  assert.equal((await call('desk_camera_get')).navigation.reason,'changed');
  assert.deepEqual(errors,[]);
 }finally{await close();}
});
