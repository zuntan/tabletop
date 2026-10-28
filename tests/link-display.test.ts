import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Desk,dispatch} from '../src/model';
import {publishObject} from '../src/object-properties';
import {encodeDeskFile,decodeDeskFile} from '../src/desk-file';
import {PartClipboard,partClipboardText} from '../src/part-clipboard';
import {propertyFieldPatch,propertyValue} from '../src/properties';
import {extractFormat} from '../src/format-style';

test('URL and QR are views of one preserved link; old links default to URL',async()=>{
 const d=new Desk();d.execute({operations:[{kind:'add',object:{id:'link',type:'link',x:50,y:100,width:500,height:300,url:'https://example.com/?a=1&b=2',text:'資料',fontSize:48}}]});
 const original=d.get('link');assert.equal(propertyValue(original,'linkDisplay'),'url');assert.equal(publishObject(original).fontSize,48);
 assert.equal(extractFormat(original).fontSize,48);
 d.execute({operations:[{kind:'update',id:'link',patch:propertyFieldPatch('linkDisplay','qr',original)}]});
 const next=d.get('link');for(const key of ['x','y','width','height','url','fontSize'] as const)assert.equal(next[key],original[key]);
 assert.equal(Object.hasOwn(publishObject(next),'qrText'),false);assert.equal(Object.hasOwn(publishObject(next),'src'),false);
 assert.equal(partClipboardText([next]),'資料\nhttps://example.com/?a=1&b=2');
 const clipboard=new PartClipboard(),values=new Map<string,string>();clipboard.write({setData:(k,v)=>{values.set(k,v);},getData:k=>values.get(k)??''},d.snapshot());const ids=clipboard.paste(d);assert.equal(d.get(ids[0]).linkDisplay,'qr');
 const decoded=await decodeDeskFile(await encodeDeskFile(d));assert.deepEqual(decoded.objects.map(publishObject),d.snapshot().map(publishObject));
 d.undo();d.undo();assert.equal(propertyValue(d.get('link'),'linkDisplay'),'url');
 assert.throws(()=>d.execute({operations:[{kind:'update',id:'link',patch:{linkDisplay:'minimal' as any}}]}));
 assert.throws(()=>d.execute({operations:[{kind:'add',object:{id:'desk',type:'link',deskPath:'/tmp/a.tabletop',linkDisplay:'qr'}}]}),/ordinary URL/);
});
test('QR export of a URL link uses its sole URL, not separate text',async()=>{
 const d=new Desk();d.execute({operations:[{kind:'add',object:{id:'link',type:'link',url:'https://example.com/',text:'題名',linkDisplay:'qr'}}]});
 let encoded='';const result=await dispatch(d,{method:'qr_render',id:'link'},undefined,undefined,undefined,undefined,undefined,async text=>{encoded=text;return {svg:'<svg/>',status:'ready'};}) as any;
 assert.equal(encoded,'https://example.com/');assert.equal(result.qrText,encoded);assert.equal(d.get('link').qrText,undefined);
});

test('QR sticker clearance reserves one diameter on both sides, independent of row count',async()=>{
 const {qrCardLayout}=await import('../src/qr-card');
 const d=new Desk();d.execute({operations:[{kind:'add',object:{id:'qr',type:'qrcode',qrText:'test',width:100,height:334}}]});
 const o=d.get('qr');assert.deepEqual(qrCardLayout(o),{y:34,height:300});
 o.stickers={items:Array.from({length:20},()=>({color:'#ff0000',shape:'circle' as const})),origin:'top-right',diameter:36,fixed:false};
 assert.deepEqual(qrCardLayout(o),{y:70,height:228});
 o.stickers.fixed=true;assert.deepEqual(qrCardLayout(o,.5),{y:106,height:156});
 o.height=60;assert.deepEqual(qrCardLayout(o,.5),{y:47,height:0});
});
