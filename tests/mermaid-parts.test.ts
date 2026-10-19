import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Desk, dispatch } from '../src/model';
import { publishObject } from '../src/object-properties';
import { encodeDeskFile, decodeDeskFile } from '../src/desk-file';
import { PartClipboard, partClipboardText } from '../src/part-clipboard';
import { shareRead } from '../src/share-read';
const source='flowchart LR\n  A[開始] --> B[終了]';
function fixture(){const d=new Desk();d.execute({operations:[{kind:'add',object:{id:'m',type:'mermaid',x:0,y:0,width:480,height:354,text:'原本',mermaidSource:source}}]});return d;}
test('Mermaid source is the persisted/public content; syntax errors remain editable and undoable',async()=>{
  const d=fixture();
  assert.equal((dispatch(d,{method:'get',id:'m'}) as any).mermaidSource,source);
  assert.equal((shareRead(d,'desk_get',d.sessionId,'m') as any).mermaidSource,source);
  const published=publishObject(d.get('m'));
  for(const key of ['src','fill','stroke','textColor','fontSize','url']) assert.equal(Object.hasOwn(published,key),false);
  const decoded=await decodeDeskFile(await encodeDeskFile(d));
  assert.deepEqual(decoded.objects.map(publishObject),d.snapshot().map(publishObject));
  d.execute({operations:[{kind:'update',id:'m',patch:{mermaidSource:'not a diagram'}}]});
  assert.equal(d.get('m').mermaidSource,'not a diagram');d.undo();assert.equal(d.get('m').mermaidSource,source);
  assert.throws(()=>d.execute({operations:[{kind:'add',object:{id:'missing',type:'mermaid',x:0,y:0}}]}),/source required/);
});
test('same-desk copies preserve source; outside clipboard uses source text',()=>{
  const d=fixture(),clip=new PartClipboard(),data=new Map<string,string>();
  clip.write({setData:(k,v)=>{data.set(k,v);},getData:k=>data.get(k)??''},d.snapshot());
  const ids=clip.paste(d);assert.equal(d.get(ids[0]).mermaidSource,source);assert.notEqual(ids[0],'m');
  assert.equal(partClipboardText([d.get('m')]),source);
});
