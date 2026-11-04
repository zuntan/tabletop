import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,mkdirSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {unzipSync,strFromU8} from 'fflate';
import {createHash} from 'node:crypto';
// @ts-expect-error Release CLI is an executable JavaScript module.
import {packageRelease} from '../scripts/package-release.mjs';
import {buildCommit} from '../scripts/build-info.mjs';

test('tagged archive excludes working files, embeds tag commit, checks version and never overwrites',()=>{
 const root=mkdtempSync(join(tmpdir(),'tabletop-release-test-'));
 try{
  const git=(...args:string[])=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  git('init');git('config','user.email','test@example.invalid');git('config','user.name','Release test');
  writeFileSync(join(root,'package.json'),JSON.stringify({version:'0.1.0'}));
  mkdirSync(join(root,'docs_devel','desk-snapshots'),{recursive:true});
  writeFileSync(join(root,'docs_devel','desk-snapshots','old.tabletop'),'historical desk');
  writeFileSync(join(root,'docs_devel','review.tabletop'),'working desk');
  writeFileSync(join(root,'docs_devel','ai-help.md'),'required help');
  mkdirSync(join(root,'docs','tabletop'),{recursive:true});
  writeFileSync(join(root,'docs','tabletop','guide.tabletop'),'public tutorial');
  mkdirSync(join(root,'output'));writeFileSync(join(root,'output','preview.png'),'working output');
  writeFileSync(join(root,'INSTALL.md'),'installation');git('add','.');git('-c','commit.gpgsign=false','commit','-m','fixture');git('tag','v0.1.0');
  const commit=git('rev-parse','HEAD');writeFileSync(join(root,'private-untracked.txt'),'not distributed');writeFileSync(join(root,'INSTALL.md'),'working change');
  const result=packageRelease(root,'v0.1.0',join(root,'output'));
  const bytes=readFileSync(join(root,'output',result.filename)),files=unzipSync(bytes);
  assert.equal(strFromU8(files['tabletop-0.1.0/INSTALL.md']),'installation');
  assert.equal(strFromU8(files['tabletop-0.1.0/docs_devel/ai-help.md']),'required help');
  assert.equal(strFromU8(files['tabletop-0.1.0/docs/tabletop/guide.tabletop']),'public tutorial');
  assert.ok(!Object.keys(files).some(p=>p.includes('/desk-snapshots/')||p.endsWith('/review.tabletop')||p.includes('/output/')));
  assert.ok(!Object.keys(files).some(p=>p.includes('.git/')||p.includes('private-untracked')));
  const info=JSON.parse(strFromU8(files['tabletop-0.1.0/release-info.json']));assert.equal(info.commit,commit);
  assert.equal(readFileSync(join(root,'output',result.filename+'.sha256'),'utf8'),`${createHash('sha256').update(bytes).digest('hex')}  ${result.filename}\n`);
  assert.throws(()=>packageRelease(root,'v0.1.0',join(root,'output')));
  git('tag','v0.2.0');assert.throws(()=>packageRelease(root,'v0.2.0',join(root,'wrong')),/version differ/);
  const extracted=join(root,'extracted');mkdirSync(extracted);assert.equal(buildCommit(extracted),'');
  writeFileSync(join(extracted,'package.json'),JSON.stringify({version:'0.1.0'}));
  writeFileSync(join(extracted,'release-info.json'),JSON.stringify(info));
  assert.equal(buildCommit(extracted),commit.slice(0,7));
  assert.equal(buildCommit(root),git('rev-parse','--short=7','HEAD'));
  writeFileSync(join(extracted,'package.json'),JSON.stringify({version:'0.2.0'}));assert.equal(buildCommit(extracted),'');
 }finally{rmSync(root,{recursive:true,force:true});}
});
