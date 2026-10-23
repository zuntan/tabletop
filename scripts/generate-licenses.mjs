// Generate redistributable notices from the exact installed production dependencies.
// No network access. Missing/unreviewed licenses stop the build instead of silently omitting them.
import {readFile,writeFile,readdir,mkdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>readFile(path.join(root,p),'utf8');
const lockSource=await read('package-lock.json'), lock=JSON.parse(lockSource);
const out=path.join(root,'public/licenses/generated');
const allowed=new Set(['MIT','ISC','BSD-2-Clause','BSD-3-Clause','Apache-2.0','PSF-2.0','Unlicense','EPL-2.0','(MPL-2.0 OR Apache-2.0)']);
// Supplemental file-level notices were reviewed for these exact upstream versions.
for(const [name,version] of [['elkjs','0.9.3'],['katex','0.18.10']]){
  if(lock.packages[`node_modules/${name}`]?.version!==version)throw Error(`Review supplemental notices after updating ${name}`);
}
const entries=[], documents=new Map();
async function noticeFiles(dir,prefix='') {
  const result=[];
  for(const f of await readdir(path.join(root,dir),{withFileTypes:true})) {
    if(f.name==='node_modules'||f.isSymbolicLink())continue;
    const relative=prefix+f.name;
    if(f.isDirectory())result.push(...await noticeFiles(`${dir}/${f.name}`,`${relative}/`));
    else if(/^(licen[cs]e|copying|notice|third.?party|copyright)([.\-_]|$)/i.test(f.name)||/\.LICENSE$/i.test(f.name))result.push(relative);
  }
  return result.sort();
}
for(const [location,locked] of Object.entries(lock.packages)) {
  if(!location||locked.dev)continue;
  const pkg=JSON.parse(await read(`${location}/package.json`));
  if(pkg.version!==locked.version)throw Error(`Installed version differs from lock: ${location}`);
  const license=pkg.license??locked.license??(pkg.name==='khroma'&&pkg.version==='2.1.0'?'MIT':null);
  if(!allowed.has(license))throw Error(`Review license before distribution: ${pkg.name}: ${license}`);
  const files=await noticeFiles(location);
  if(!files.length)throw Error(`No license text: ${location}`);
  const id=`${pkg.name}@${pkg.version}`, url=`generated/${pkg.name.replace(/[^a-zA-Z0-9._-]/g,"_")}@${pkg.version}.txt`;
  let repository=typeof pkg.repository==='string'?pkg.repository:pkg.repository?.url;
  repository=repository?.replace(/^git\+/,'').replace(/^git:\/\/github.com\//,'https://github.com/').replace(/\.git$/,'');
  const selection=pkg.name==='dompurify'?'Apache-2.0':license;
  const text=[id,`License: ${selection}`,`Source: ${repository??locked.resolved}`,`npm artifact: ${locked.resolved}`,
    pkg.name==='dompurify'?'Tabletop selects the Apache-2.0 option. The upstream alternative license is retained for reference.':'',
    ...await Promise.all(files.map(async f=>`\n--- ${f} ---\n\n${await read(`${location}/${f}`)}`))].join('\n');
  if(documents.has(url)&&documents.get(url)!==text+'\n')throw Error(`Different notices for same package: ${id}`);
  documents.set(url,text+'\n');
  entries.push({name:pkg.name,version:pkg.version,license:selection,path:location,source:repository??locked.resolved,notice:url});
}
for(const required of ['OFL-1.1.txt','Apache-2.0.txt','EPL-1.0.txt','katex-notices.txt','elk-sources.txt','elk-copyrights.txt','GWT-COPYING.txt','GWT-emulation-COPYING.txt','Guava-COPYING.txt'])await read(`licenses/supplemental/${required}`);
const supplementalNames=(await readdir(path.join(root,'licenses/supplemental'))).filter(f=>f!=='sources.json').sort();
for(const name of supplementalNames)documents.set(`generated/supplemental/${name}`,await read(`licenses/supplemental/${name}`));
const extras=[
 {name:'Tabler Icons',version:'vendored',license:'MIT',source:'https://github.com/tabler/tabler-icons',notice:'tabler-icons.txt'},
 {name:'KaTeX（補足）',version:'0.18.10',license:'OFL-1.1 / Apache-2.0',notice:'generated/supplemental/katex-notices.txt'},
 {name:'ELK（補足・ソース）',version:'0.9.3',license:'EPL-2.0 / EPL-1.0 / Apache-2.0',notice:'generated/supplemental/elk-sources.txt'},
];
const unique=[...new Map(entries.map(e=>[e.notice,e])).values()].sort((a,b)=>a.name.localeCompare(b.name,'en'));
const manifest={lockSha256:createHash('sha256').update(lockSource).digest('hex'),scope:'Production dependency closure (browser and MCP server); includes conservative transitive/type/CLI entries, excludes devDependencies.',entries:[...extras,...unique]};
const header=`Tabletop — Third-party notices\n\nTabletop itself is MIT licensed; third-party components retain their own licenses.\nThis collection covers the locked production dependency closure, not only browser chunks.\nDOMPurify uses its Apache-2.0 option. Supplemental notices include KaTeX and ELK internals.\nDevelopment tools, Node and Chrome are not included in this collection and must not be bundled without their own notices.\n\n`;
const aggregate=header+[...documents].map(([file,text])=>`\n${'='.repeat(72)}\n${file}\n${'='.repeat(72)}\n${text}`).join('\n')+`\n${'='.repeat(72)}\nTabler Icons\n${await read('public/licenses/tabler-icons.txt')}`;
// Construct everything successfully before replacing the generated output.
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
for(const [url,text] of documents){const dest=path.join(root,'public/licenses',decodeURIComponent(url));await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,text);}
await writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await writeFile(path.join(root,'public/licenses/THIRD_PARTY_NOTICES.txt'),aggregate);
await writeFile(path.join(root,'public/licenses/tabletop-MIT.txt'),await read('LICENSE'));
console.log(`License notices: ${unique.length} package versions (${entries.length} dependency locations), ${extras.length} supplemental entries.`);
