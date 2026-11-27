import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import upstream from 'wireloom';
import patched from '../src/vendor/wireloom/index.js';
import {Desk,dispatch} from '../src/model';
import {encodeDeskFile,decodeDeskFile} from '../src/desk-file';
import {PartClipboard} from '../src/part-clipboard';
import {anchorPoint} from '../src/geometry';
import {wrapWireloomText} from '../src/wireloom-text-layout';

test('Wireloom width patch preserves Latin SVG and separates Japanese labels',async()=>{
  const examples=[
    'window "Settings":\n  panel:\n    checkbox "Notify me" checked label-right\n    button "Save" primary',
    'window "Tasks":\n  list:\n    item "First"\n    item "Second"',
    'window "Mixed":\n  panel:\n    text "A long English notice"\n    row:\n      button "Cancel"\n      button "Continue"',
  ];
  for(const count of [2,7,11,19,31,97])examples.push(`window "${'a'.repeat(count)}":\n  panel:\n    text "Title metrics"`);
  for(const source of examples)assert.equal((await patched.render('test',source)).svg,(await upstream.render('test',source)).svg);
  const source='window "設定":\n  panel:\n    row:\n      button "長い名前のボタン"\n      button "保存" primary';
  const before=(await upstream.render('test',source)).svg,after=(await patched.render('test',source)).svg;
  assert.notEqual(after,before);assert.ok(after.includes('長い名前のボタン'));
  assert.ok(Number(after.match(/viewBox="0 0 ([\d.]+)/)?.[1])>Number(before.match(/viewBox="0 0 ([\d.]+)/)?.[1]));
  for(const name of ['checkbox-japanese','complex','settings','list']) {
    const example=await readFile(`docs_devel/wireframe-comparison/wireloom-review/${name}.wireloom`,'utf8');
    assert.ok((await patched.render('test',example)).svg.includes('<svg'));
  }
});

test('Wireloom sources round-trip, copy, render through a read bridge and follow anchors',async()=>{
  const source='window "Example":\n  panel:\n    button "Save" primary';
  const desk=new Desk();desk.execute({snap:'exact',operations:[{kind:'add',object:{id:'w',type:'wireloom',x:100,y:100,width:400,height:300,wireloomSource:source}}]});
  assert.equal(desk.list()[0].wireloomSource,source);
  const revision=desk.revision;
  const rendered=await dispatch(desk,{method:'wireloom_render',id:'w'},undefined,undefined,undefined,undefined,undefined,undefined,{wireloom:s=>patched.render('test',s)}) as {svg:string;wireloomSource:string;revision:number};
  assert.equal(rendered.wireloomSource,source);assert.equal(rendered.revision,revision);assert.equal(desk.revision,revision);
  assert.ok(rendered.svg.includes('<svg'));
  assert.deepEqual(anchorPoint(desk.get('w'),'bottom-right'),{x:500,y:400});
  const archive=await decodeDeskFile(await encodeDeskFile(desk));const restored=new Desk();restored.replaceDocument({objects:archive.objects,settings:archive.settings});
  assert.equal(restored.get('w').wireloomSource,source);
  const clipboard=new PartClipboard(),values=new Map<string,string>();clipboard.write({setData:(k,v)=>{values.set(k,v);},getData:k=>values.get(k)??''},[desk.get('w')]);
  assert.equal(values.get('text/plain'),source);const ids=clipboard.paste(desk);assert.equal(desk.get(ids[0]).wireloomSource,source);
  desk.execute({operations:[{kind:'update',id:'w',patch:{wireloomSource:'bad source'}}]});desk.undo();assert.equal(desk.get('w').wireloomSource,source);
  assert.throws(()=>desk.execute({operations:[{kind:'add',object:{id:'missing',type:'wireloom'}}]}));
  assert.throws(()=>desk.execute({operations:[{kind:'update',id:'w',patch:{wireloomSource:'x'.repeat(100001)}}]}));
});

test('Wireloom rejects invalid syntax and escapes markup without active image or script references',async()=>{
  await assert.rejects(patched.render('test','not-a-window "Oops"'));
  const {svg}=await patched.render('test','window "Escape":\n  panel:\n    text "<script>alert(1)</script> & <img src=x>"');
  assert.ok(!/<script|<foreignObject|<image|href=/i.test(svg));assert.ok(svg.includes('&lt;script&gt;'));
});

test('explicit text width wraps English and Japanese, reserves height, and preserves source serialization',async()=>{
  for(const text of ['Please review the changes before saving your document.','これは長い日本語の注意書きです。変更した内容を確認してください。','日本語と English words を混ぜて、確認してください。']) {
    const source=`window "Notice":\n  panel:\n    text "${text}" width=140\n    button "Next"`;
    const {svg}=await patched.render('test',source);
    const texts=[...svg.matchAll(/<text [^>]*y="([\d.]+)"[^>]*>([^<]*)<\/text>/g)];
    const last=texts.find(t=>t[2]==='Next')!;
    assert.ok(texts.length>4);assert.ok(Number(last[1])>Number(texts.at(-2)![1]));
    assert.ok(patched.serialize(patched.parse(source)).includes('width=140'));
  }
  for(const width of [0,-1,100001])await assert.rejects(patched.render('test',`window:\n  panel:\n    text "Oops" width=${width}`));
  const measure=(s:string)=>Array.from(s).length;
  const lines=wrapWireloomText('英語の（notice）です。Hello world',8,measure);
  assert.ok(lines.every(line=>!/[（「『]$/.test(line)&&!/^[。、）」』]/.test(line)),JSON.stringify(lines));
  assert.deepEqual(wrapWireloomText('Hello world again',11,measure),['Hello world','again']);
  assert.deepEqual(wrapWireloomText('A\n\nB',10,measure),['A','','B']);
  assert.deepEqual(wrapWireloomText('A\n   \nB',10,measure),['A','','B']);
  assert.deepEqual(wrapWireloomText('abcdefghij',4,measure),['abcd','efgh','ij']);
});
