import {mkdir,writeFile,readdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),destination=path.join(root,'dist-pages');
await writeFile(path.join(destination,'.nojekyll'),'');
// Publish only intentionally placed user-facing desk files; never development snapshots.
async function copyDesks(source,target){
 let entries;try{entries=await readdir(source,{withFileTypes:true});}catch(error){if(error.code==='ENOENT')return;throw error;}
 for(const entry of entries){
  if(entry.name.startsWith('.'))continue;
  const from=path.join(source,entry.name),to=path.join(target,entry.name);
  if(entry.isDirectory())await copyDesks(from,to);
  else if(entry.isFile()&&entry.name.endsWith('.tabletop')){await mkdir(target,{recursive:true});await copyFile(from,to);}
 }
}
await copyDesks(path.join(root,'docs/tabletop'),path.join(destination,'desks'));
