import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cp,mkdir,mkdtemp,readFile,readdir,rm,symlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
async function files(dir:string,prefix=''):Promise<Record<string,string>> {
  const result:Record<string,string>={};
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const name=prefix+entry.name,full=path.join(dir,entry.name);
    if(entry.isDirectory())Object.assign(result,await files(full,name+'/'));
    else result[name]=await readFile(full,'utf8');
  }
  return result;
}

test('license generation is identical for LF and CRLF checkouts and repeat builds',{timeout:30000},async()=>{
  const temporary=await mkdtemp(path.join(tmpdir(),'tabletop-license-newlines-'));
  try{
    await mkdir(path.join(temporary,'scripts'));
    await cp(path.join(root,'scripts/generate-licenses.mjs'),path.join(temporary,'scripts/generate-licenses.mjs'));
    await cp(path.join(root,'licenses/supplemental'),path.join(temporary,'licenses/supplemental'),{recursive:true});
    await mkdir(path.join(temporary,'public/licenses'),{recursive:true});
    await cp(path.join(root,'public/licenses/tabler-icons.txt'),path.join(temporary,'public/licenses/tabler-icons.txt'));
    for(const name of ['LICENSE','package-lock.json'])await cp(path.join(root,name),path.join(temporary,name));
    await symlink(path.join(root,'node_modules'),path.join(temporary,'node_modules'),process.platform==='win32'?'junction':'dir');
    const inputs=['LICENSE','package-lock.json','public/licenses/tabler-icons.txt',...Object.keys(await files(path.join(temporary,'licenses/supplemental'))).map(p=>'licenses/supplemental/'+p)];
    const original=await Promise.all(inputs.map(p=>readFile(path.join(temporary,p),'utf8')));
    const generate=()=>execFileSync(process.execPath,['scripts/generate-licenses.mjs'],{cwd:temporary,stdio:'pipe'});
    for(let i=0;i<inputs.length;i++)await writeFile(path.join(temporary,inputs[i]),original[i].replace(/\r\n?/g,'\n'));
    generate();const lf=await files(path.join(temporary,'public/licenses'));
    for(let i=0;i<inputs.length;i++)await writeFile(path.join(temporary,inputs[i]),original[i].replace(/\r\n?/g,'\n').replace(/\n/g,'\r\n'));
    generate();const crlf=await files(path.join(temporary,'public/licenses'));
    // The Tabler input remains user checkout text; only generated outputs are compared.
    delete lf['tabler-icons.txt'];delete crlf['tabler-icons.txt'];
    assert.deepEqual(crlf,lf);
    for(const [name,text]of Object.entries(crlf))assert.ok(!text.includes('\r'),name+' must use LF');
    generate();const repeated=await files(path.join(temporary,'public/licenses'));delete repeated['tabler-icons.txt'];
    assert.deepEqual(repeated,crlf);
  }finally{await rm(temporary,{recursive:true,force:true});}
});
