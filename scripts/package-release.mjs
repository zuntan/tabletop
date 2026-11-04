import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';

export function packageRelease(root,tag,output) {
  if(!/^v\d+\.\d+\.\d+$/.test(tag))throw Error('Release tag must be vX.Y.Z');
  const git=(...args)=>execFileSync('git',args,{cwd:root,maxBuffer:128*1024*1024});
  const commit=git('rev-parse',`refs/tags/${tag}^{commit}`).toString().trim();
  if(commit!==git('rev-parse','HEAD').toString().trim())throw Error('Checkout must match the release tag');
  const files=unzipSync(git('archive','--format=zip',commit));
  const {version}=JSON.parse(strFromU8(files['package.json']));
  if(tag!==`v${version}`)throw Error('Tag and package.json version differ');
  if(files['release-info.json'])throw Error('release-info.json must not be tracked');
  const timestamp=git('show','-s','--format=%cI',commit).toString().trim();
  const info={version,tag,commit};
  files['release-info.json']=strToU8(JSON.stringify(info,null,2)+'\n');
  const prefix=`tabletop-${version}`,entries={};
  // One top-level folder, only tagged files plus generated provenance, stable ZIP timestamps.
  for(const name of Object.keys(files).sort())entries[`${prefix}/${name}`]=[files[name],{mtime:new Date(timestamp)}];
  const bytes=zipSync(entries,{level:6});
  const filename=`${prefix}.zip`,checksum=createHash('sha256').update(bytes).digest('hex');
  mkdirSync(output,{recursive:true});
  writeFileSync(join(output,filename),bytes,{flag:'wx'});
  writeFileSync(join(output,`${filename}.sha256`),`${checksum}  ${filename}\n`,{flag:'wx'});
  return {...info,filename,checksum};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  console.log(JSON.stringify(packageRelease(process.cwd(),process.argv[2]??'',resolve(process.argv[3]??'release-artifacts'))));
}
