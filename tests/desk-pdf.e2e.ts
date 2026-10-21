import {test} from 'node:test';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {openTestDesk} from './desk-browser';

const capture=`window.__pdfBlob=null; const originalCreateObjectURL=URL.createObjectURL.bind(URL); URL.createObjectURL=function(blob){if(blob.type==='application/pdf')window.__pdfBlob=blob;return originalCreateObjectURL(blob);};`;
test('file menu exports a single all-desk PDF independent of zoom/selection without editing',{timeout:60000},async()=>{
 const {page,call,close,errors}=await openTestDesk('desk-pdf',capture);
 try{
  await call('desk_asset_import',{id:'picture',source:{svg:'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#fbbf24"/><circle cx="180" cy="140" r="120" fill="#ef4444"/><text x="30" y="150" font-size="34">IMAGE</text></svg>'},x:250,y:80,width:400,height:334});
  await call('desk_execute',{operations:[
   {kind:'desk_rename',name:'PDF export test 日本語'},
   {kind:'background_update',patch:{wallpaper:'cutting-mat'}},
   {kind:'add',object:{id:'note',type:'text',x:-550,y:-160,width:600,height:360,text:'## 日本語の机\n\n**画面の外もPDFへ。**\n\n- 型抜きと画像\n- ハンコ・ピン・図形\n- 位置と重なり順',fill:'#fff7ed',fillOpacity:1,fontSize:28,padding:24,stamp:{designId:'done_ja',text:'2026.10.21',angle:-5},reactions:['👍']}},
   {kind:'add',object:{id:'mold',type:'ellipse',x:300,y:160,width:250,height:200}},
   {kind:'cutout',id:'picture',moldId:'mold'},
   {kind:'update',id:'mold',patch:{x:1000,y:450}},
   {kind:'add',object:{id:'far',type:'diamond',x:1700,y:850,width:400,height:240,text:'画面外の終点',fill:'#d8b4fe',fillOpacity:1}},
   {kind:'add',object:{id:'mermaid',type:'mermaid',x:750,y:-150,width:500,height:330,text:'Mermaid',mermaidSource:'flowchart LR\nA[開始]-->B{判断}-->C[完了]'}},
   {kind:'label_add',id:'pin',seriesId:'series-1',x:80,y:350},
   {kind:'add',object:{id:'line',type:'line',x:0,y:0,x2:1900,y2:970,startBinding:{objectId:'pin',anchor:'center'},endBinding:{objectId:'far',anchor:'left'},strokeWidth:5,stroke:'#ef4444',endMarker:'arrow'}}
  ]});
  await page.waitForFunction(()=>document.querySelector('[data-id="mermaid"]')?.getAttribute('data-mermaid-status')==='ready');
  await call('desk_select',{ids:['note']});await call('desk_point',{ids:['picture']});
  await call('desk_camera_move',{center:{x:200,y:100},zoom:.35,durationMs:0});
  const before=await call('desk_state');
  await page.locator('#file-menu').click();assert.equal(await page.locator('#file-menu-panel > button').count(),3);
  const popupPromise=page.waitForEvent('popup');await page.locator('#open-desk-pdf').click();const popup=await popupPromise;
  await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.includes('のPDFを開きました'));
  const bytes=await page.evaluate(async()=>Array.from(new Uint8Array(await (window as unknown as Window&{__pdfBlob:Blob}).__pdfBlob.arrayBuffer())));
  await mkdir('output/pdf',{recursive:true});await writeFile('output/pdf/tabletop-desk-export-test.pdf',Buffer.from(bytes));
  assert.equal((await call('desk_summary')).revision,before.revision);assert.deepEqual((await call('desk_state')).objects,before.objects);
  assert.match(Buffer.from(bytes).toString('latin1'),/\/Count 1/);assert.match(Buffer.from(bytes).toString('latin1'),/\/DCTDecode/);
  await popup.close();
  await call('desk_camera_move',{center:{x:1800,y:1000},zoom:1.4,durationMs:0});await call('desk_select',{ids:[]});await call('desk_point',{ids:[]});
  await page.locator('#file-menu').click();const second=page.waitForEvent('popup');await page.locator('#open-desk-pdf').click();const next=await second;
  await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.includes('のPDFを開きました'));
  const again=await page.evaluate(async()=>Array.from(new Uint8Array(await (window as unknown as Window&{__pdfBlob:Blob}).__pdfBlob.arrayBuffer())));
  assert.deepEqual(Buffer.from(again),Buffer.from(bytes));await next.close();
  await page.evaluate(()=>{window.open=()=>null;});await page.locator('#file-menu').click();await page.locator('#open-desk-pdf').click();
  await page.waitForFunction(()=>document.querySelector('#message.error')?.textContent?.includes('ポップアップ'));
  assert.deepEqual(errors,[]);
 }finally{await close();}
});
