import {test} from 'node:test';import assert from 'node:assert/strict';
import {createServer} from 'node:http';import {once} from 'node:events';import {readFile} from 'node:fs/promises';import {resolve,extname} from 'node:path';import {chromium} from 'playwright';
import {Desk} from '../src/model';import {encodeDeskFile} from '../src/desk-file';
test('Pages focuses saved or URL card using selection fit and shows a read-only ID',{timeout:45000},async()=>{
 const d=new Desk();d.execute({operations:[{kind:'add',object:{id:'start',type:'text',x:0,y:0,width:600,height:400,text:'Start'}},{kind:'add',object:{id:'other',type:'text',x:10000,y:10000,width:1000,height:600,text:'Other'}},{kind:'initial_view_update',targetId:'start'}]});
 const bytes=await encodeDeskFile(d);const server=createServer(async(req,res)=>{try{const path=new URL(req.url!,'http://localhost').pathname;if(path==='/guide.tabletop'){res.writeHead(200,{'Content-Type':'application/zip'}).end(bytes);return;}const file=resolve('dist-pages','.'+(path==='/'?'/index.html':path));const body=await readFile(file);res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml'} as Record<string,string>)[extname(file)]??'application/octet-stream'}).end(body);}catch{res.writeHead(404).end();}});server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${(server.address() as any).port}`;
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome'});const page=await browser.newPage({viewport:{width:1400,height:1000}});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  for(const [query,id] of [['','start'],['&focus=other','other']] as const){
   await page.goto(base+'/?desk=guide.tabletop'+query);await page.waitForFunction(id=>!!document.querySelector(`[data-human-selection="${id}"]`),id);
   const initial=await page.locator('#viewport').getAttribute('transform');await page.locator('#fit').click();await page.waitForFunction(initial=>document.querySelector('#viewport')?.getAttribute('transform')===initial,initial);
   assert.equal(await page.locator('[data-human-selection]').count(),1);
  }
  await page.locator('#desk-menu').click();await page.getByRole('button',{name:'机の見た目…',exact:true}).click();assert.equal(await page.locator('#initial-focus-id').textContent(),'start');assert.equal(await page.locator('#initial-focus-id').evaluate(e=>e.tagName),'OUTPUT');
  await page.goto(base+'/?desk=guide.tabletop&focus=missing');await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.includes('初期表示の対象が見つかりません'));assert.equal(await page.locator('[data-human-selection]').count(),0);assert.deepEqual(errors,[]);
 }finally{await browser.close();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
