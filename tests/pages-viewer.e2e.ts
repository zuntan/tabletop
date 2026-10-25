import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
import {Desk} from '../src/model';
import {encodeDeskFile,decodeDeskFile} from '../src/desk-file';

test('Pages serves from a repository subpath, opens a URL without MCP, and keeps upload/download and relative desk links',{timeout:45_000},async()=>{
 const guide=new Desk();guide.execute({operations:[{kind:'desk_rename',name:'Pages guide'},{kind:'background_update',patch:{wallpaper:'wood-1'}},
  {kind:'add',object:{id:'note',type:'text',text:'Hello **Pages**',stamp:{designId:'done_ja',text:'fixed',angle:-3}}},
  {kind:'add',object:{id:'mermaid',type:'mermaid',mermaidSource:'graph LR; A-->B',x:600}},
  {kind:'add',object:{id:'other',type:'link',text:'Other desk',deskPath:'other.tabletop',x:800,y:400}},
 ]});const bytes=await encodeDeskFile(guide);
 const other=new Desk();other.execute({operations:[{kind:'desk_rename',name:'Other product'},{kind:'add',object:{id:'other-note',type:'text',text:'other'}}]});const otherBytes=await encodeDeskFile(other);
 const root=resolve('dist-pages'),requests:string[]=[];const types:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'};
 const server=createServer(async(req,res)=>{const path=new URL(req.url!,'http://localhost').pathname;requests.push(path);try{
  if(path.endsWith('/desks/guide.tabletop')){res.end(bytes);return;}
  if(path.endsWith('/desks/other.tabletop')||path==='/another-product/guide.tabletop'){res.end(otherBytes);return;}
  const relative=path.startsWith('/tabletop/')?path.slice('/tabletop/'.length):path.slice(1);
  const file=resolve(root,relative||'index.html');if(!file.startsWith(root+'/')){res.writeHead(403).end();return;}
  const body=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream'}).end(body);
 }catch{res.writeHead(404).end();}});server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
 const browser=await chromium.launch({headless:true,executablePath:process.env.TABLETOP_CHROME??'/usr/bin/google-chrome'}),page=await browser.newPage({viewport:{width:1400,height:1000}}),errors:string[]=[],sockets:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('websocket',ws=>sockets.push(ws.url()));
 try{
  await page.goto(base+'/tabletop/?desk=desks/guide.tabletop#token=ignored-token-for-pages-0123456789&port=4317');await page.waitForFunction(()=>document.querySelector('#desk-name')?.textContent==='Pages guide');
  assert.equal(await page.locator('#confirm-dialog').count(),0);assert.equal(await page.locator('#count').textContent(),'3');
  for(const id of ['connection','thinking-mode','desk-bell','desk-bell-options','bell-led','ai-activity-led','clear-ai-pointing','tab-connection'])assert.equal(await page.locator('#'+id).isVisible(),false,id);
  assert.equal(await page.locator('#canvas .markdown-text strong').first().textContent(),'Pages');
  await page.waitForFunction(()=>document.querySelector('[data-id="mermaid"] image')?.getAttribute('href')?.startsWith('data:image/svg+xml'));
  assert.ok(requests.includes('/tabletop/wallpapers/wood-1.png'));assert.equal(requests.some(p=>p.includes('connection-policy')||p.includes('/bridge')),false);assert.deepEqual(sockets,[]);
  await page.locator('#prop-open').click();
  await page.waitForFunction(()=>[...document.querySelectorAll<HTMLImageElement>('#prop-palette img')].every(image=>image.complete&&image.naturalWidth>0));
  const preset=page.locator('[data-prop-preset]').first();await preset.click();
  await page.waitForFunction(()=>document.querySelector('#count')?.textContent==='4');
  assert.equal(await page.locator('#objects [data-id] image').evaluateAll(images=>images.some(image=>image.getAttribute('href')?.startsWith('data:image/svg+xml;base64,'))),true);
  assert.ok(requests.some(path=>path.startsWith('/tabletop/props/')));assert.equal(requests.some(path=>path.startsWith('/props/')),false);
  await page.keyboard.press('Escape');await page.locator('#undo').click();await page.waitForFunction(()=>document.querySelector('#count')?.textContent==='3');
  await page.screenshot({path:'/tmp/tabletop-pages-loaded.png'});
  await page.locator('#file-menu').focus();await page.keyboard.press('ArrowDown');assert.equal(await page.evaluate(()=>document.activeElement?.id),'download-desk');
  assert.equal(await page.locator('#file-menu-panel button:visible').count(),3);await page.keyboard.press('Escape');
  const downloading=page.waitForEvent('download');await page.locator('#file-menu').click();await page.locator('#download-desk').click();const downloaded=await downloading;const decoded=await decodeDeskFile(await readFile((await downloaded.path())!));assert.equal(decoded.objects.length,3);
  await page.locator('#desk-menu').click();await page.getByRole('button',{name:'Tabletopについて…'}).click();const notice=await page.getByRole('link',{name:'すべてのライブラリ・ライセンス',exact:true}).getAttribute('href');assert.equal(new URL(notice!,page.url()).pathname,'/tabletop/licenses/THIRD_PARTY_NOTICES.txt');assert.equal((await page.request.get(new URL(notice!,page.url()).href)).status(),200);await page.keyboard.press('Escape');
  await page.locator('[data-add="text"]').click();await page.locator('[data-inline-text]').fill('offline edit');await page.keyboard.press('Enter');
  const savedBeforeSwitch=page.waitForEvent('download');await page.locator('[data-open-desk="other"]').click();await page.locator('[data-dialog-choice="save"]').click();
  const savedDesk=await decodeDeskFile(await readFile((await (await savedBeforeSwitch).path())!));assert.equal(savedDesk.objects.length,4);await page.waitForFunction(()=>document.querySelector('#desk-name')?.textContent==='Other product');assert.equal(await page.locator('#count').textContent(),'1');
  await page.goto(base+'/tabletop/?desk='+encodeURIComponent(base+'/another-product/guide.tabletop'));await page.waitForFunction(()=>document.querySelector('#desk-name')?.textContent==='Other product');
  await page.locator('#desk-file').setInputFiles({name:'uploaded.tabletop',mimeType:'application/zip',buffer:Buffer.from(bytes)});await page.locator('[data-dialog-choice="confirm"]').click();await page.waitForFunction(()=>document.querySelector('#desk-name')?.textContent==='Pages guide');
  await page.goto(base+'/?desk=desks/guide.tabletop');await page.waitForFunction(()=>document.querySelector('#desk-name')?.textContent==='Pages guide');
  // Capture PDF bytes while keeping this test in HTML (native PDF viewers differ by browser).
  await page.addInitScript(()=>{
   const original=URL.createObjectURL.bind(URL);
   URL.createObjectURL=(blob:Blob|MediaSource)=>{
    if(blob instanceof Blob&&blob.type==='application/pdf'){
     (window as any).__pdfBlob=blob;
     (window as any).__pdfMermaidReady=document.querySelector('[data-id="mermaid"]')?.getAttribute('data-mermaid-status');
     return location.href+'#pdf-captured';
    }
    return original(blob);
   };
  });
  for(const value of ['1','yes']){
   await page.goto(base+'/tabletop/?desk=desks/guide.tabletop&pdf='+value);
   await page.waitForURL('**#pdf-captured');
   const pdf=await page.evaluate(async()=>({bytes:Array.from(new Uint8Array(await (window as any).__pdfBlob.arrayBuffer())),ready:(window as any).__pdfMermaidReady}));
   assert.equal(pdf.ready,'ready');assert.match(Buffer.from(pdf.bytes).toString('latin1'),/^%PDF-/);
  }
  await page.goto(base+'/tabletop/?desk=desks/guide.tabletop&pdf=');await page.waitForFunction(()=>document.querySelector('#desk-name')?.textContent==='Pages guide');assert.equal(await page.evaluate(()=>!!(window as any).__pdfBlob),false);
  await page.goto(base+'/tabletop/?desk=missing.tabletop&pdf=1');await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.includes('HTTP 404'));assert.equal(await page.locator('#count').textContent(),'0');assert.equal(await page.evaluate(()=>!!(window as any).__pdfBlob),false);
  await page.screenshot({path:'/tmp/tabletop-pages-viewer.png'});assert.deepEqual(errors,[]);assert.deepEqual(sockets,[]);
 }finally{await browser.close();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
