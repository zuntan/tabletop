import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {openTestDesk} from './desk-browser';

test('area prop frames resize while sign lettering stays fixed, with transparent content and embedded portable SVG',{timeout:30000},async()=>{
  const {page,call,close,errors}=await openTestDesk('area-props');
  try{
    const presets=[];
    for(const id of ['vacant-lot','work-in-progress','temporary-area']){
      const preset=await call('desk_prop_get',{id});presets.push(preset);
      await call('desk_asset_import',{id,asProp:true,source:{svg:preset.svg},title:preset.name,x:0,y:0,width:480,height:354});
      const source=(await call('desk_get',{id})).src;
      await call('desk_execute',{operations:[{kind:'update',id,patch:{width:960,height:674}}]});
      assert.equal((await call('desk_get',{id})).src,source);
      assert.equal((await call('desk_asset_read',{id})).svg,preset.svg);
    }
    const sizes=await page.evaluate(async(presets)=>{
      const stage=document.createElement('div');stage.id='area-prop-review';Object.assign(stage.style,{position:'fixed',inset:'0',zIndex:'100',overflow:'auto',background:'#edf1f5',padding:'12px'});document.body.append(stage);
      const results=[];
      for(const preset of presets){
        const row=document.createElement('div');row.style.display='flex';row.style.gap='16px';stage.append(row);
        const measurements=[];
        for(const [width,height] of [[480,320],[720,400],[2400,1200]]){
          const color=preset.id==='vacant-lot'?[68,107,80]:preset.id==='work-in-progress'?[103,85,62]:[78,105,123];
          const src='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(preset.svg)));
          const root=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><image href="${src}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/></svg>`;
          const image=new Image();image.src='data:image/svg+xml;base64,'+btoa(root);await image.decode();
          const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;row.append(canvas);
          const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,width,height).data;
          let minX=width,maxX=0,minY=height,maxY=0,count=0;
          for(let y=0;y<height;y++)for(let x=0;x<width;x++){
            const i=(y*width+x)*4;
            if(data[i+3]>220&&color.every((c,k)=>Math.abs(data[i+k]-c)<8)){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);count++;}
          }
          measurements.push({textWidth:maxX-minX+1,textHeight:maxY-minY+1,count,centerAlpha:ctx.getImageData(width/2,height/2,1,1).data[3],frameAlpha:ctx.getImageData(16,Math.round(height*.6),1,1).data[3],otherEdges:[ctx.getImageData(width-16,Math.round(height*.6),1,1).data[3],ctx.getImageData(Math.round(width*.25),28,1,1).data[3],ctx.getImageData(Math.round(width*.25),height-16,1,1).data[3]]});
        }
        results.push({id:preset.id,measurements});
      }
      return results;
    },presets);
    for(const {id,measurements} of sizes){
     const [a,b]=measurements;
     for(const m of measurements){assert.ok(m.frameAlpha>0&&m.otherEdges.every(alpha=>alpha>0),`${id}: fixed frame inset on all edges at every size`);assert.ok(Math.abs(m.textWidth-a.textWidth)<=2,`${id}: fixed lettering on large areas`);}
      assert.ok(a.count>100&&b.count>100,`${id}: lettering is visible`);
      assert.ok(Math.abs(a.textWidth-b.textWidth)<=2,`${id}: fixed lettering width`);
      assert.ok(Math.abs(a.textHeight-b.textHeight)<=2,`${id}: fixed lettering height`);
      assert.ok(a.frameAlpha>0&&b.frameAlpha>0,`${id}: frame follows new dimensions`);
      if(id!=='work-in-progress')assert.equal(a.centerAlpha+b.centerAlpha,0,`${id}: center is transparent`);
    }
    await mkdir('tmp/area-props',{recursive:true});await page.screenshot({path:'tmp/area-props/size-comparison.png'});
    assert.deepEqual(errors,[]);
  }finally{await close();}
});
