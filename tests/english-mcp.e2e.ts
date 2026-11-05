import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile, rm} from 'node:fs/promises';
import {decodeDeskFile} from '../src/desk-file';
import {openTestDesk} from './desk-browser';

test('English MCP instructions select an existing Japanese completion stamp and preserve user content through save', {timeout:45000}, async () => {
  const {page,call,client,close,errors}=await openTestDesk('english-mcp',undefined,undefined,'en-US');
  const path=`/tmp/tabletop-english-mcp-${randomUUID()}.tabletop`;
  try {
    const definitions=await client.listTools();
    for (const tool of definitions.tools) {
      assert.match(tool.name,/^desk_[a-z_]+$/);
      assert.match(tool.description ?? '',/[A-Za-z]/,tool.name);
    }
    const help=await client.callTool({name:'desk_help',arguments:{topic:'card-splitting'}});
    assert.notEqual(help.isError,true);
    assert.match((help.content as any)[0].text,/Preserve the original/);
    const catalog=await call('desk_stamp_patterns');
    const completed=catalog.patterns.find((p:any)=>/^Completed/.test(p.style)&&p.id.endsWith('_ja'));
    assert.ok(completed,'completion meaning is discoverable without translating artwork');
    assert.equal(completed.id,'done_ja');
    const original='検討メモ — Keep this text unchanged';
    await call('desk_execute',{operations:[{kind:'add',object:{id:'original',type:'text',text:original}}]});
    await call('desk_execute',{operations:[{kind:'update',id:'original',patch:{stamp:{designId:completed.id,text:'Reviewed',angle:-3}}}]});
    const before=await call('desk_get',{id:'original'});
    assert.equal(before.text,original);
    assert.deepEqual(before.stamp,{designId:'done_ja',text:'Reviewed',angle:-3});
    await page.locator('#desk-menu').click();
    await page.locator('#desk-menu-panel > .desk-menu-item').nth(1).click();
    await page.locator('#ui-language').selectOption('ja');
    await page.waitForFunction(()=>document.documentElement.lang==='ja');
    assert.deepEqual(await call('desk_stamp_patterns'),catalog);
    assert.deepEqual(await call('desk_get',{id:'original'}),before);
    await call('desk_save',{path});
    const saved=await decodeDeskFile(await readFile(path));
    const restored=saved.objects.find(object=>object.id==='original')!;
    assert.equal(restored.text,original);
    assert.deepEqual(restored.stamp,before.stamp);
    assert.equal('language' in saved.settings,false);
    assert.deepEqual(errors,[]);
  } finally {await close();await rm(path,{force:true});}
});
