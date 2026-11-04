import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
// @ts-expect-error Release CLI is an executable JavaScript module.
import {draftRelease} from '../scripts/draft-release.mjs';

test('release upload is draft-only, identical retries are safe, and changed assets are never replaced',async()=>{
 const folder=mkdtempSync(join(tmpdir(),'tabletop-draft-test-'));
 try{
  const zip=Buffer.from('archive'),name='tabletop-0.1.0.zip';
  const sha=Buffer.from(`${createHash('sha256').update(zip).digest('hex')}  ${name}\n`);
  writeFileSync(join(folder,name),zip);writeFileSync(join(folder,name+'.sha256'),sha);
  const release={id:1,tag_name:'v0.1.0',draft:true,html_url:'https://example.invalid/draft',upload_url:'https://uploads.example.invalid/assets{?name,label}'};
  const assets:{id:number;name:string;url:string;bytes:Buffer}[]=[];const writes:string[]=[];
  let published=false,created=false;
  const fetchImpl=async(input:string|URL,options:RequestInit={})=>{
   const u=new URL(input);const method=options.method??'GET';
   if(method==='POST'){
    writes.push(u.pathname);
    if(u.pathname.endsWith('/releases')){assert.equal(JSON.parse(String(options.body)).draft,true);created=true;return Response.json(release);}
    assert.ok(!published);const filename=u.searchParams.get('name')!;assets.push({id:assets.length+1,name:filename,url:`https://api.example.invalid/asset/${assets.length+1}`,bytes:Buffer.from(options.body as Uint8Array)});return Response.json({});
   }
   if(u.pathname.includes('/asset/'))return new Response(new Uint8Array(assets.find(a=>a.url===u.href)!.bytes).buffer);
   if(u.pathname.endsWith('/assets'))return Response.json(assets);
   if(u.pathname.endsWith('/releases/1'))return Response.json({...release,draft:!published});
   return Response.json(created?[{...release,draft:!published}]:[]);
  };
  const args={folder,tag:'v0.1.0',repo:'test/tabletop',token:'fake-test-token',apiRoot:'https://api.example.invalid',fetchImpl};
  await draftRelease(args);assert.equal(writes.length,3);assert.equal(assets.length,2);
  await draftRelease(args);assert.equal(writes.length,3);
  assets[0].bytes=Buffer.from('different');await assert.rejects(draftRelease(args),/replacement refused/);assert.equal(writes.length,3);
  published=true;await assert.rejects(draftRelease(args),/Published releases/);assert.equal(writes.length,3);
 }finally{rmSync(folder,{recursive:true,force:true});}
});
