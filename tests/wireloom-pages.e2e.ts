import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
import {Desk} from '../src/model';
import {encodeDeskFile,decodeDeskFile} from '../src/desk-file';

test('Pages renders and edits a Wireloom card without MCP, including Japanese/English wrapping', {timeout:45_000},async()=>{
  const desk=new Desk();const source='window "Notice":\n  panel:\n    text "Please review your changes before saving the document." width=220\n    text "変更内容を確認してください。日本語と English words の折り返しです。" width=220\n  footer:\n    button "Cancel"\n    button "Save" primary';
  desk.execute({snap:'exact',operations:[{kind:'desk_rename',name:'Wireloom trial'},{kind:'add',object:{id:'wireframe',type:'wireloom',x:0,y:0,width:600,height:700,text:'Wireloom',wireloomSource:source}}]});
  const bytes=await encodeDeskFile(desk),root=resolve('dist-pages');
  const types:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'};
  const server=createServer(async(req,res)=>{
    try {
      const path=new URL(req.url!,'http://localhost').pathname;
      if(path==='/tabletop/demo.tabletop'){res.end(bytes);return;}
      const file=resolve(root,path.replace(/^\/tabletop\//,'')||'index.html');
      if(!file.startsWith(root+'/')){res.writeHead(403).end();return;}
      res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream'}).end(await readFile(file));
    }catch{res.writeHead(404).end();}
  });server.listen(0,'127.0.0.1');await once(server,'listening');
  const port=(server.address() as {port:number}).port;
  const browser=await chromium.launch({headless:true,executablePath:process.env.TABLETOP_CHROME??'/usr/bin/google-chrome'});
  const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors:string[]=[],sockets:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('websocket',ws=>sockets.push(ws.url()));
  try {
    await page.goto(`http://127.0.0.1:${port}/tabletop/?desk=demo.tabletop`);
    const card=page.locator('[data-id="wireframe"][data-wireloom-status="ready"]');await card.waitFor();
    assert.equal(await card.locator('image').evaluate(async el=>{const image=new Image();image.src=el.getAttribute('href')!;await image.decode();return image.naturalWidth>0;}),true);
    await card.screenshot({path:'/tmp/tabletop-wireloom-pages.png'});
    await card.dblclick();const input=page.locator('[data-inline-wireloom]');assert.equal(await input.inputValue(),source);
    assert.equal(await page.locator('[data-wireloom-preview]').count(),0);
    const edited=source.replace('Notice','Review');await input.fill(edited);await input.press('Control+Enter');await card.waitFor();
    const download=page.waitForEvent('download');await page.locator('#file-menu').click();await page.locator('#download-desk').click();
    const file=await download;const saved=await decodeDeskFile(new Uint8Array(await readFile((await file.path())!)));
    assert.equal(saved.objects.find(o=>o.id==='wireframe')?.wireloomSource,edited);
    assert.deepEqual(sockets,[]);assert.deepEqual(errors,[]);
  }finally{await browser.close();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
