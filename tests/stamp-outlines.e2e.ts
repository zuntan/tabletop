import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openTestDesk} from './desk-browser';

test('all fixed stamp lettering is outlined while dates and arbitrary supplementary strings remain text', {timeout:45000}, async () => {
  const {page,call,close,errors}=await openTestDesk('stamp-outlines',undefined,undefined,'en-US');
  try {
    const {patterns}=await call('desk_stamp_patterns');
    await call('desk_execute',{operations:patterns.map((p:any)=>({kind:'add',object:{id:p.id,type:'text',text:'',x:0,y:0,width:480,height:360,stamp:{designId:p.id,text:'2026.11.05',angle:0}}}))});
    const result=await page.locator('[data-id] [data-stamp]').evaluateAll(nodes=>nodes.map(n=>({id:n.getAttribute('data-stamp'),text:[...n.querySelectorAll('text')].map(t=>t.textContent),outlines:n.querySelectorAll('[data-stamp-outline] path').length})));
    assert.equal(result.length,38);
    for(const r of result){
      assert.deepEqual(r.text,['2026.11.05'],r.id ?? '');
      assert.equal(r.outlines>0,!['hanamaru_ja','smile_ja'].includes(r.id!),r.id ?? '');
    }
    const lettering = await page.locator('[data-id] [data-stamp-outline]').evaluateAll(nodes => nodes.map(n => {
      const box=(n as SVGGraphicsElement).getBBox();
      return {text:n.getAttribute('data-stamp-outline'),category:n.getAttribute('data-stamp-font-category'),height:box.height,width:box.width};
    }));
    const done=lettering.find(n=>n.text==='DONE')!,rejected=lettering.find(n=>n.text==='REJECTED')!;
    assert.equal(done.category,'E');assert.equal(rejected.category,'E');
    assert.ok(Math.abs(done.height-rejected.height)<.01,'long English words retain the same ink height');
    assert.equal(lettering.find(n=>n.text==='済')?.category,'A');
    assert.equal(lettering.find(n=>n.text==='が')?.category,'B');
    assert.equal(lettering.find(n=>n.text==='しらんがな')?.category,'C');
    assert.equal(lettering.find(n=>n.text==='READ')?.category,'D');
    assert.equal(lettering.find(n=>n.text==='?')?.category,'F');
    assert.ok(lettering.find(n=>n.text==='…')!.height<lettering.find(n=>n.text==='欲しい')!.height*.35,'ellipsis dots stay much smaller than the main lettering');
    // A supplementary value equal to a fixed label is still user text, never substituted.
    for(const designId of ['done_ja','handle_with_care_ja','shirangana_ja','done_en','hanamaru_ja','physical_checked_ja']) {
      await call('desk_execute',{operations:[{kind:'update',id:designId,patch:{stamp:{designId,text:'済',angle:-7}}}]});
      assert.equal(await page.locator(`[data-id="${designId}"] [data-stamp] text`).textContent(),'済');
      assert.deepEqual((await call('desk_get',{id:designId})).stamp,{designId,text:'済',angle:-7});
    }
    await call('desk_execute',{operations:[{kind:'update',id:'done_en',patch:{stamp:{designId:'future-design',text:'<keep>日本語</keep>',angle:4}}}]});
    assert.equal(await page.locator('[data-id="done_en"] [data-stamp] text').last().textContent(),'<keep>日本語</keep>');
    assert.equal(await page.locator('[data-id="done_en"] [data-stamp] keep').count(),0);
    assert.deepEqual(errors,[]);
  } finally {await close();}
});

test('fixed stamp raster output is identical with and without system Japanese fonts', {timeout:60000}, async () => {
  const {mkdtemp,writeFile,rm}=await import('node:fs/promises');
  const directory=await mkdtemp('/tmp/tabletop-stamp-fonts-');
  const config=directory+'/fonts.conf', previous=process.env.FONTCONFIG_FILE;
  await writeFile(config,`<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd"><fontconfig><dir>/usr/share/fonts/truetype/liberation</dir><dir>/usr/share/fonts/truetype/liberation2</dir><cachedir>${directory}/cache</cachedir></fontconfig>`);
  const results:unknown[]=[];
  try {
    for(const restricted of [false,true]) {
      if(restricted)process.env.FONTCONFIG_FILE=config;
      else if(previous)process.env.FONTCONFIG_FILE=previous;else delete process.env.FONTCONFIG_FILE;
      const {page,call,close,errors}=await openTestDesk('stamp-font-independent-'+restricted,undefined,undefined,'en-US');
      try {
        const {patterns}=await call('desk_stamp_patterns');
        await call('desk_execute',{operations:patterns.map((p:any)=>({kind:'add',object:{id:p.id,type:'text',text:'',x:0,y:0,width:480,height:360,stamp:{designId:p.id,text:'',angle:0}}}))});
        const hashes=await page.locator('[data-id] [data-stamp]').evaluateAll(async nodes=>{
          const hashes=[];
          for(const node of nodes){
            if(node.querySelector('text'))throw new Error('Fixed artwork still contains font-rendered text');
            const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="190" viewBox="-120 -75 240 150">${node.innerHTML}</svg>`;
            const image=new Image();image.src='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svg)));await image.decode();
            const canvas=document.createElement('canvas');canvas.width=240;canvas.height=190;
            const context=canvas.getContext('2d')!;context.drawImage(image,0,0);
            const digest=await crypto.subtle.digest('SHA-256',context.getImageData(0,0,240,190).data);
            hashes.push({id:node.getAttribute('data-stamp'),hash:[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('')});
          }
          return hashes;
        });
        assert.equal(hashes.length,38);results.push(hashes);assert.deepEqual(errors,[]);
      } finally {await close();}
    }
    assert.deepEqual(results[1],results[0]);
  } finally {
    if(previous)process.env.FONTCONFIG_FILE=previous;else delete process.env.FONTCONFIG_FILE;
    await rm(directory,{recursive:true,force:true});
  }
});

test('turning dates off removes only the date, retaining all artwork and dividers',{timeout:45000},async()=>{
 const {page,call,close,errors}=await openTestDesk('stamp-date-only');
 try{
  const {patterns}=await call('desk_stamp_patterns');
  await call('desk_execute',{operations:patterns.flatMap((p:any)=>['dated','blank'].map(mode=>({kind:'add',object:{id:p.id+'-'+mode,type:'text',x:0,y:0,width:480,height:360,text:'',stamp:{designId:p.id,text:mode==='dated'?'2026.11.05':'',angle:0}}})))});
  const artwork=await page.locator('[data-id] [data-stamp]').evaluateAll(nodes=>nodes.map(node=>{
   const copy=node.cloneNode(true) as Element;copy.querySelectorAll('[data-stamp-date]').forEach(n=>n.remove());
   return{id:node.closest('[data-id]')!.getAttribute('data-id'),svg:copy.innerHTML.replace(/(?:stamp-care-hands-\d+|additional-stamp-\d+-)/g,'stable-id-')};
  }));
  for(const pattern of patterns){assert.equal(artwork.find(n=>n.id===pattern.id+'-dated')!.svg,artwork.find(n=>n.id===pattern.id+'-blank')!.svg,pattern.id);}
  assert.deepEqual(errors,[]);
 }finally{await close();}
});
