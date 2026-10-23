import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import ts from 'typescript';
import {openTestDesk} from './desk-browser';

test('stationery deletion uses the shared commit, queue, Undo and motion cancellation',{timeout:30000},async()=>{
  const {page,call,close,errors}=await openTestDesk('stationery-delete');
  try{
    await call('desk_execute',{operations:['a','b'].map((id,i)=>({kind:'add',object:{id,type:'text',x:100+i*300,y:100,width:250,height:180,text:'## 消しても戻る\n本文と色を残す',fill:'#fee2e2',fillOpacity:1}}))});
    for(const mode of ['eraser','particles']){
      await call('desk_select',{ids:['a','b']});const before=await call('desk_summary');
      await page.locator('#delete-style').click();await page.locator(`#delete-${mode}`).click();
      await page.locator('#bh-delete-overlay').waitFor();
      assert.equal(await page.locator('#bh-delete-overlay').getAttribute('data-mode'),mode);
      const state=await call('desk_summary');assert.equal(state.count,0);assert.equal(state.revision,before.revision+1);
      await call('desk_undo');await page.waitForFunction(()=>!document.querySelector('#bh-delete-overlay'));
      assert.equal((await call('desk_summary')).count,2);
      await call('desk_select',{ids:['a']});await page.locator('#delete').click();
      await page.locator('#bh-delete-overlay').waitFor();
      await page.waitForFunction(()=>!document.querySelector('#bh-delete-overlay'));
      assert.equal((await call('desk_summary')).count,1);await call('desk_undo');
    }
    await page.emulateMedia({reducedMotion:'reduce'});await call('desk_select',{ids:['a']});
    await page.locator('#delete-style').click();await page.locator('#delete-eraser').click();
    await page.waitForFunction(()=>!document.querySelector('[data-id="a"]'));
    assert.equal(await page.locator('#bh-delete-overlay').count(),0);assert.deepEqual(errors,[]);
  }finally{await close();}
});

test('canvas effects preserve original pixels, erase progressively, and leave no final residue',{timeout:20000},async()=>{
  const {page,close,errors}=await openTestDesk('stationery-frames');
  try{
    const source=await readFile('src/stationery-delete-animation.ts','utf8');
    const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
    await page.route('**/stationery-effect-test.js',route=>route.fulfill({contentType:'text/javascript',body:compiled}));
    const result=await page.evaluate(async(modulePath)=>{
      const effects=await import(modulePath);
      const source=document.createElement('canvas');source.width=320;source.height=220;
      const sourceCtx=source.getContext('2d')!;sourceCtx.fillStyle='#fff7ed';sourceCtx.fillRect(0,0,320,220);
      sourceCtx.fillStyle='#334155';sourceCtx.font='bold 24px sans-serif';sourceCtx.fillText('Tabletop',28,55);
      sourceCtx.font='16px sans-serif';sourceCtx.fillText('A little stationery magic.',28,90);
      sourceCtx.fillStyle='#f87171';sourceCtx.fillRect(28,120,130,65);
      sourceCtx.fillStyle='#60a5fa';sourceCtx.beginPath();sourceCtx.arc(235,153,35,0,Math.PI*2);sourceCtx.fill();
      const image=new Image();image.src=source.toDataURL();await image.decode();
      const eraser=new Image();eraser.src='/props/eraser.svg';await eraser.decode();
      const stage=document.createElement('div');stage.id='effect-review';Object.assign(stage.style,{position:'fixed',inset:'0',zIndex:'100',background:'#26313d',display:'grid',gridTemplateColumns:'repeat(3, 400px)',gap:'8px',padding:'12px'});
      document.body.append(stage);
      const results:{mode:string;counts:number[];sourceCorner:number[]}[]=[];
      for(const mode of ['eraser','particles']){
        const counts:number[]=[],sourceCorner:number[]=[];
        for(const time of [0,850,mode==='eraser'?1900:1500]){
          const holder=document.createElement('div');holder.style.color='white';holder.textContent=`${mode} · ${time} ms`;
          const canvas=document.createElement('canvas');canvas.width=400;canvas.height=350;holder.append(canvas);stage.append(holder);
          const ctx=canvas.getContext('2d')!,box={x:40,y:80,width:320,height:220};
          const draw=mode==='eraser'?effects.eraserFrames(ctx,image,box,eraser):effects.particleFrames(ctx,image,box);draw(time);
          const pixels=ctx.getImageData(0,0,400,350).data;
          counts.push(Array.from({length:pixels.length/4},(_,i)=>pixels[i*4+3]).filter(a=>a>0).length);
          if(time===0)sourceCorner.push(...ctx.getImageData(60,100,1,1).data);
        }
        results.push({mode,counts,sourceCorner});
      }
      return results;
    },'/stationery-effect-test.js');
    for(const row of result){
      assert.ok(row.counts[0]>68000);assert.ok(row.counts[1]>0&&row.counts[1]<row.counts[0]);
      assert.equal(row.counts[2],0);assert.deepEqual(row.sourceCorner,[255,247,237,255]);
    }
    await mkdir('tmp/stationery-delete',{recursive:true});await page.screenshot({path:'tmp/stationery-delete/frames.png'});
    assert.deepEqual(errors,[]);
  }finally{await close();}
});
