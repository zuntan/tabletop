import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

export async function draftRelease({tag,folder='release-artifacts',repo,token,apiRoot='https://api.github.com',fetchImpl=fetch}) {
if(!/^v\d+\.\d+\.\d+$/.test(tag??'')||!repo||!token)throw Error('Tag, GITHUB_REPOSITORY and GH_TOKEN are required');
const name=`tabletop-${tag.slice(1)}.zip`,root=resolve(folder);
const archive=readFileSync(join(root,name)),checksum=readFileSync(join(root,name+'.sha256'));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
if(checksum.toString()!==`${digest(archive)}  ${name}\n`)throw Error('Checksum does not match archive');
const endpoint=`${apiRoot}/repos/${repo}`;
async function request(url,options={}){
 const response=await fetchImpl(url,{...options,headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,...options.headers}});
 if(!response.ok)throw Error(`GitHub API ${response.status}: ${await response.text()}`);
 return response;
}
let release;
for(let page=1;;page++){
 const items=await(await request(`${endpoint}/releases?per_page=100&page=${page}`)).json();
 release=items.find(item=>item.tag_name===tag);
 if(release||items.length<100)break;
}
if(release&&!release.draft)throw Error('Published releases are never modified');
if(!release){
 const body=`Tabletop ${tag.slice(1)}\n\n## ダウンロード\n\n添付の **${name}** を取得し、展開後の INSTALL.md に従って導入してください。Node.js 22.12以降が必要です。\n\nこのZIPにはタグ先のコミット情報を同梱しています。GitHub自動生成の Source code アーカイブとは異なります。\n\n${name}.sha256 でZIPのSHA-256を照合できます。\n\n公開前に配布ZIPからの導入と接続・保存・読込を確認し、リリースノートを整えてください。`;
 release=await(await request(`${endpoint}/releases`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tag_name:tag,name:`Tabletop ${tag.slice(1)}`,draft:true,prerelease:false,body})})).json();
}
for(const [filename,bytes,type]of [[name,archive,'application/zip'],[name+'.sha256',checksum,'text/plain']]){
 // Recheck draft state immediately before each write; never delete/overwrite existing assets.
 const current=await(await request(`${endpoint}/releases/${release.id}`)).json();
 if(!current.draft)throw Error('Release was published; upload stopped');
 const assets=await(await request(`${endpoint}/releases/${release.id}/assets?per_page=100`)).json();
 const existing=assets.find(asset=>asset.name===filename);
 if(existing){
  const previous=new Uint8Array(await(await request(existing.url,{headers:{Accept:'application/octet-stream'}})).arrayBuffer());
  if(digest(previous)!==digest(bytes))throw Error(`Existing ${filename} differs; automatic replacement refused`);
  console.log(`Already attached, identical: ${filename}`);continue;
 }
 const upload=new URL(current.upload_url.split('{')[0]);upload.searchParams.set('name',filename);
 await request(upload,{method:'POST',headers:{'Content-Type':type},body:bytes});
 console.log(`Attached to draft: ${filename}`);
}
console.log(`Draft ready: ${release.html_url}`);

return release.html_url;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 await draftRelease({tag:process.argv[2],folder:process.argv[3],repo:process.env.GITHUB_REPOSITORY,token:process.env.GH_TOKEN,apiRoot:process.env.GITHUB_API_URL});
}
