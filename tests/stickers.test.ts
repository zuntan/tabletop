import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Desk } from '../src/model';
import { stickerSchema,stickerLayout,stickerPoints,stickerOperations } from '../src/sticker-values';
import { encodeDeskFile,decodeDeskFile } from '../src/desk-file';
import { PartClipboard } from '../src/part-clipboard';

test('stickers retain duplicate color order, wrap to inward rows from all four corners without a height limit',()=>{
 const config=stickerSchema.parse({colors:['red','blue','red','yellow'],diameter:10,fixed:false});
 assert.equal(stickerLayout(44,config).columns,3);
 for(const origin of ['top-left','top-right','bottom-left','bottom-right'] as const){
  const points=stickerPoints(44,80,{...config,origin});
  const right=origin.endsWith('right'),bottom=origin.startsWith('bottom');
  const x=right?34:10,y=bottom?70:10;
  assert.deepEqual(points[0],{x,y,color:'red',shape:'circle',diameter:10});
  assert.equal(points[1].x,x+(right?-12:12));assert.equal(points[3].x,x);assert.equal(points[3].y,y+(bottom?-12:12));
 }
 const narrow=stickerPoints(1,1,{...config,origin:'bottom-right'});assert.equal(narrow[0].x,.5);assert.equal(narrow[3].x,.5);assert.equal(narrow[3].y,-35.5);
 const fixed={...config,fixed:true};assert.equal(stickerLayout(44,fixed,.5).columns,1);assert.equal(stickerLayout(44,fixed,.5).diameter,20);
 assert.deepEqual(stickerLayout(44,config,.5),stickerLayout(44,config,2));
 assert.equal(stickerSchema.parse({}).diameter,36);assert.equal(stickerSchema.parse({}).fixed,false);
 const mixed=stickerSchema.parse({items:[{color:'red',shape:'star'},{color:'blue',shape:'triangle'},{color:'red',shape:'diamond'}]});assert.deepEqual(mixed.items.map(item=>item.shape),['star','triangle','diamond']);
 assert.throws(()=>stickerSchema.parse({items:[],colors:[]}));

});

test('stickers are meaningful parent attributes, append/clear preserve settings and survive copy, archive and Undo',async()=>{
 const desk=new Desk();desk.execute({operations:[
  {kind:'add',object:{id:'a',type:'text',text:'a'}},
  {kind:'add',object:{id:'b',type:'ellipse'}},
  {kind:'add',object:{id:'line',type:'line'}},
 ]});
 const selected=()=>['a','b','line'].map(id=>desk.get(id));
 desk.execute({operations:stickerOperations(selected(),{kind:'append',color:'#ef4444'})});
 desk.execute({operations:stickerOperations(selected(),{kind:'append',color:'#ef4444'})});
 assert.deepEqual(desk.get('a').stickers?.items.map(item=>item.color),['#ef4444','#ef4444']);assert.equal(desk.get('line').stickers,undefined);
 desk.execute({operations:stickerOperations(selected(),{kind:'settings',patch:{origin:'bottom-right',diameter:36,fixed:false}})});
 const before=desk.get('a').stickers;
 desk.execute({operations:stickerOperations(selected(),{kind:'clear'})});assert.deepEqual(desk.get('a').stickers,{...before,items:[]});
 desk.undo();assert.deepEqual(desk.get('a').stickers,before);
 const cb=new PartClipboard(),data=new Map<string,string>();cb.write({setData:(k,v)=>{data.set(k,v)},getData:k=>data.get(k)??''},[desk.get('a')]);const ids=cb.paste(desk);assert.deepEqual(desk.get(ids[0]).stickers,before);
 const saved=await decodeDeskFile(await encodeDeskFile(desk));const loaded=new Desk();loaded.replaceDocument({objects:saved.objects,settings:saved.settings});assert.deepEqual(loaded.list(),desk.list());
 for(const type of ['line','clip','prop'] as const) assert.throws(()=>desk.execute({operations:[{kind:'add',object:{id:'bad-'+type,type,...(type==='prop'?{src:'data:image/svg+xml;base64,PHN2Zy8+'}:{}),stickers:{colors:['red']}}}]}));
 assert.throws(()=>stickerSchema.parse({colors:['url(evil)']}));assert.throws(()=>stickerSchema.parse({diameter:0}));
 assert.throws(()=>stickerSchema.parse({colors:['red'],x:3}));
});
