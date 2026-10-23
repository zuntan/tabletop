import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

test('distributed notices cover the locked production closure and retain component notices',async()=>{
  const read=(p:string)=>readFile(new URL('../'+p,import.meta.url),'utf8');
  const source=await read('package-lock.json'), lock=JSON.parse(source);
  const manifest=JSON.parse(await read('public/licenses/generated/manifest.json'));
  assert.equal(manifest.lockSha256,createHash('sha256').update(source).digest('hex'),'Regenerate notices after dependency changes');
  for(const [path,entry] of Object.entries(lock.packages) as [string,{dev?:boolean;version:string}][]){
    if(!path||entry.dev)continue;
    const pkg=JSON.parse(await read(path+'/package.json'));
    const notice=manifest.entries.find((e:{name:string;version:string})=>e.name===pkg.name&&e.version===entry.version);
    assert.ok(notice,`Missing production notice: ${path}`);
    assert.ok((await read('public/licenses/'+notice.notice)).length>100,`Missing text: ${path}`);
  }
  const text=await read('public/licenses/THIRD_PARTY_NOTICES.txt');
  for(const expected of ['Kiel University','Copyright 2020 Google LLC','Design Science','Facebook','Underscore','SIL OPEN FONT LICENSE','Eclipse Public License - v 2.0','Eclipse Public License - v 1.0','https://github.com/kieler/elkjs/tree/0.9.3','https://github.com/eclipse-elk/elk/tree/v0.9.1'])assert.ok(text.includes(expected),expected);
  assert.equal(await read('public/licenses/tabletop-MIT.txt'),await read('LICENSE'));
});
