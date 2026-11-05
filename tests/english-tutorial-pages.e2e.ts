import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';

test('Pages ships and opens the English tutorial at its saved introduction',{timeout:45000},async()=>{
 const artifact=await readFile('dist-pages/desks/tabletop-guide-en.tabletop');
 assert.deepEqual(artifact,await readFile('docs/tabletop/tabletop-guide-en.tabletop'));
 const root=resolve('dist-pages');
 const server=createServer(async(req,res)=>{try{
  const path=new URL(req.url!,'http://localhost').pathname;
  const file=resolve(root,'.'+(path==='/'?'/index.html':path));
  if(!file.startsWith(root+'/')){res.writeHead(403).end();return;}
  const body=await readFile(file);
  res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml'} as Record<string,string>)[extname(file)]??'application/octet-stream'}).end(body);
 }catch{res.writeHead(404).end();}});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const browser=await chromium.launch({headless:true,executablePath:process.env.TABLETOP_CHROME??'/usr/bin/google-chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1400,height:1000},locale:'en-US'});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${(server.address() as {port:number}).port}/?desk=desks/tabletop-guide-en.tabletop`);
  await page.locator('[data-locked-selection="text-0cc36b55"]').waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  await page.waitForFunction(()=>document.querySelectorAll('[data-mermaid-status="ready"]').length===3);
  assert.equal(await page.locator('#objects > [data-id]').count(),774);
  const start=page.locator('[data-id="text-0cc36b55"]');
  assert.match((await start.textContent())!,/Start with the green/);
  await page.locator('#sidebar-toggle').click();
  await page.screenshot({path:'/tmp/tabletop-english-tutorial-pages.png'});
  await page.locator('#desk-menu').click();
  await page.getByRole('button',{name:'Language…',exact:true}).click();
  await page.locator('#ui-language').selectOption('ja');
  assert.equal(await page.locator('html').getAttribute('lang'),'ja');
  assert.match((await start.textContent())!,/Start with the green/,'UI language must not translate saved desk content');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
