import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Page} from 'playwright';
import {openTestDesk} from './desk-browser';
const copy=async(page:Page)=>{await page.locator('#canvas').focus();return page.evaluate(()=>{
 const data=new DataTransfer();document.querySelector('#canvas')!.dispatchEvent(new ClipboardEvent('copy',{clipboardData:data,bubbles:true,cancelable:true}));
 return Object.fromEntries(data.types.map(type=>[type,data.getData(type)]));
});};
const paste=async(page:Page,values:Record<string,string>)=>{await page.locator('#canvas').focus();await page.evaluate(values=>{
 const data=new DataTransfer();for(const [type,value] of Object.entries(values))data.setData(type,value);
 document.querySelector('#canvas')!.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));
},values);};

test('paste resolves the clipboard token across paired tabs, keeps groups/media, and falls back when absent',{timeout:30_000},async()=>{
 const fixture=await openTestDesk('cross-clipboard'),{page,client,call,port,close}=fixture;
 const other=await page.context().browser()!.newPage();
 const request=async(name:string,args:Record<string,unknown>={})=>{const r=await client.callTool({name,arguments:args});assert.notEqual(r.isError,true,JSON.stringify(r));return JSON.parse((r.content as {text:string}[])[0].text);};
 try{
  const image='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><circle cx="5" cy="5" r="5"/></svg>').toString('base64');
  await call('desk_execute',{operations:[
   {kind:'series_update',id:'series-1',patch:{fill:'#f00',name:'red'}},
   {kind:'add',object:{id:'a',type:'text',text:'A',fill:'#fedcba'}},
   {kind:'add',object:{id:'b',type:'text',text:'B'}},
   {kind:'add',object:{id:'clip',type:'clip',clipMembers:['a','b']}},
   {kind:'add',object:{id:'svg',type:'svg',src:image}},
   {kind:'add',object:{id:'folder',type:'file',text:'Folder',x:-100,y:-100,width:1200,height:1200,fileMembers:['a','b','clip','svg']}},
   {kind:'label_add',id:'pin',seriesId:'series-1',x:1400,y:200},
  ]});
  await call('desk_select',{ids:['folder','pin']});const data=await copy(page);
  // No registration was performed at copy time: open/pair the recipient afterward.
  await request('desk_pairing_open',{confirm:true});
  await other.goto(`http://127.0.0.1:${port}/#token=cross-clipboard-012345678901234567890123456789&port=${port}`);
  await other.waitForFunction(()=>document.querySelector('#connection')?.textContent==='MCP接続済み');
  const deskId=(await other.locator('#desk-id').textContent())!;
  await paste(other,data);await other.waitForFunction(()=>document.querySelector('#message')?.textContent?.includes('別の机から貼り付け'));
  const state=await request('desk_state',{deskId});assert.equal(state.count,6);
  const clip=state.objects.find((o:any)=>o.type==='clip'),svg=state.objects.find((o:any)=>o.type==='svg'),pin=state.objects.find((o:any)=>o.type==='label');
  assert.equal(state.objects.find((o:any)=>o.type==='file').fileMembers.length,4);assert.equal(svg.src,image);assert.notEqual(pin.seriesId,'series-1');assert.equal(pin.fill,'#f00');assert.ok(clip.clipMembers.every((id:string)=>state.objects.some((o:any)=>o.id===id)));
  assert.equal((await call('desk_summary')).count,6);
  await request('desk_undo',{deskId});assert.equal((await request('desk_summary',{deskId})).count,0);
  // External copy has no marker and must never return the old object snapshot.
  await paste(other,{'text/plain':'external text'});await other.waitForFunction(()=>document.querySelector('#count')?.textContent==='1');
  let next=await request('desk_state',{deskId});assert.equal(next.objects[0].text,'external text');
  // Unknown marker falls back to the supplied text.
  await paste(other,{'application/x-tabletop-copy':crypto.randomUUID(),'text/plain':'not a known copy'});
  await other.waitForFunction(()=>document.querySelector('#count')?.textContent==='2');
  next=await request('desk_state',{deskId});assert.equal(next.objects[1].text,'not a known copy');
  // Missing source also falls back; same-tab copy remains usable without the source.
  await page.close();await paste(other,data);await other.waitForFunction(()=>document.querySelector('#count')?.textContent==='3');
  assert.equal((await request('desk_state',{deskId})).objects[2].type,'text');
 }finally{await other.close();await close();}
});

test('native Ctrl+C/Ctrl+V works in both directions and toolbar/local paste stay usable',{timeout:30_000},async()=>{
 const {page,client,call,port,close}=await openTestDesk('cross-native');const other=await page.context().browser()!.newPage();
 const request=async(name:string,args:Record<string,unknown>)=>{const r=await client.callTool({name,arguments:args});assert.notEqual(r.isError,true,JSON.stringify(r));return JSON.parse((r.content as {text:string}[])[0].text);};
 try{
  await page.context().grantPermissions(['clipboard-read','clipboard-write']);await other.context().grantPermissions(['clipboard-read','clipboard-write']);
  await call('desk_execute',{operations:[{kind:'add',object:{id:'shape',type:'roundedRect',text:'native A',fill:'#12ab34'}}]});
  await call('desk_select',{ids:['shape']});await page.bringToFront();await page.locator('#canvas').focus();await page.keyboard.press('Control+c');
  await request('desk_pairing_open',{confirm:true});await other.goto(`http://127.0.0.1:${port}/#token=cross-native-012345678901234567890123456789&port=${port}`);
  await other.waitForFunction(()=>document.querySelector('#connection')?.textContent==='MCP接続済み');const deskId=(await other.locator('#desk-id').textContent())!;
  await other.locator('#canvas').focus();await other.keyboard.press('Control+v');await other.waitForFunction(()=>document.querySelector('#count')?.textContent==='1');
  const copied=(await request('desk_state',{deskId})).objects[0];assert.equal(copied.type,'roundedRect');assert.equal(copied.fill,'#12ab34');
  await request('desk_execute',{deskId,operations:[{kind:'update',id:copied.id,patch:{text:'native B',fill:'#ab1234'}}]});
  await other.locator('#canvas').focus();await other.keyboard.press('Control+c');
  await page.bringToFront();await page.locator('#canvas').focus();await page.keyboard.press('Control+v');await page.waitForFunction(()=>document.querySelector('#count')?.textContent==='2');
  assert.equal((await call('desk_state')).objects[1].fill,'#ab1234');
  // Toolbar follows the same remote lookup path.
  await page.locator('#clipboard').click();await page.waitForFunction(()=>document.querySelector('#count')?.textContent==='3');
  // Same-tab snapshot takes priority and still works after intentionally releasing MCP.
  await page.locator('#canvas').focus();await page.keyboard.press('Control+c');await call('desk_release',{confirm:true});
  await page.waitForFunction(()=>document.querySelector('#connection')?.textContent==='AI接続解放済み');
  await page.bringToFront();await page.locator('#canvas').focus();await page.keyboard.press('Control+v');await page.waitForFunction(()=>document.querySelector('#count')?.textContent==='4');
 }finally{await other.close();await close();}
});
