import assert from 'node:assert/strict';
import {test} from 'node:test';
import QRCode from 'qrcode';
import {renderQrCode} from '../src/qr-code';
import {Desk,dispatch} from '../src/model';
import {publishObject} from '../src/object-properties';
import {encodeDeskFile,decodeDeskFile} from '../src/desk-file';
import {PartClipboard,partClipboardText} from '../src/part-clipboard';
import {anchorsFor,anchorPoint} from '../src/geometry';

test('QR rendering encodes original whitespace, Japanese and XML-like input with library defaults',async()=>{
 for(const source of ['  日本語\nhttps://example.com/?a=1&b=2  ','<script>alert("x")</script>',' ']){
  const r=await renderQrCode(source);assert.equal(r.status,'ready');
  assert.equal(r.svg,await QRCode.toString(source,{type:'svg'}));assert.equal(decodeURIComponent(r.src.split(',')[1]),r.svg);
 }
});
test('capacity overflow produces a labelled error QR and can recover without rewriting input',async()=>{
 assert.equal((await renderQrCode('a'.repeat(2331))).status,'ready');
 const r=await renderQrCode('a'.repeat(2332));assert.equal(r.status,'too-long');assert.match(r.svg,/>長すぎます<\/text>/);assert.match(r.svg,/fill="white" stroke="black"/);
 assert.equal((await renderQrCode('1'.repeat(5596))).status,'ready');
 assert.equal((await renderQrCode('あ'.repeat(778))).status,'too-long');
 assert.equal((await renderQrCode('短く直した')) .status,'ready');assert.equal((await renderQrCode('')).status,'empty');
});
test('QR data, bindings and decorations survive copy, archive and Undo with no generated asset',async()=>{
 const d=new Desk(),source='  渡したい文字\n';d.execute({operations:[
  {kind:'add',object:{id:'q',type:'qrcode',x:0,y:0,width:300,height:334,text:'メモ',qrText:source}},
  {kind:'add',object:{id:'l',type:'line',startBinding:{objectId:'q',anchor:'right'},x2:800,y2:100}},
 ]});
 assert.equal(anchorsFor(d.get('q')).length,8);assert.deepEqual(anchorPoint(d.get('q'),'top'),{x:150,y:0});
 assert.equal(partClipboardText([d.get('q')]),source);assert.equal(Object.hasOwn(publishObject(d.get('q')),'src'),false);
 d.execute({operations:[{kind:'update',id:'q',patch:{x:100,qrText:'あ'.repeat(1000)}}]});
 assert.equal(d.get('l').x,400);assert.equal(d.get('q').qrText?.length,1000);d.undo();assert.equal(d.get('q').qrText,source);
 const clip=new PartClipboard(),values=new Map<string,string>();clip.write({setData:(k,v)=>{values.set(k,v);},getData:k=>values.get(k)??''},d.snapshot());
 const ids=clip.paste(d),copy=ids.map(id=>d.get(id)).find(o=>o.type==='qrcode')!;assert.equal(copy.qrText,source);
 const decoded=await decodeDeskFile(await encodeDeskFile(d));assert.deepEqual(decoded.objects.map(publishObject),d.snapshot().map(publishObject));
 assert.throws(()=>d.execute({operations:[{kind:'add',object:{id:'missing',type:'qrcode'}}]}),/QR text required/);
});
test('QR cards participate in clips, rulers, files and cutout as media',()=>{
 for(const owner of ['clip','ruler','file']){
  const d=new Desk();d.execute({operations:[{kind:'add',object:{id:'q',type:'qrcode',qrText:'hello',width:300,height:334}}]});
  const object=owner==='clip'?{id:'c',type:'clip' as const,clipMembers:['q']}:owner==='ruler'?{id:'c',type:'ruler' as const,rulerMembers:[{id:'q',side:'after' as const}]}:{id:'c',type:'file' as const,fileMembers:['q'],x:-24,y:-58,width:348,height:416};
  d.execute({operations:[{kind:'add',object}]});assert.equal(d.get('c').type,owner);
 }
 const d=new Desk();d.execute({operations:[{kind:'add',object:{id:'q',type:'qrcode',qrText:'hello',width:300,height:334}},{kind:'add',object:{id:'mask',type:'ellipse',x:10,y:50,width:100,height:100}},{kind:'cutout',id:'q',moldId:'mask'}]});assert.ok(d.get('q').cutout?.enabled);
});
