import test from 'node:test';
import assert from 'node:assert/strict';
import {Desk} from '../src/model';
import {newPartGridSize} from '../src/grid';

test('new ordinary cards round dimensions upward and align both corners',()=>{
 const d=new Desk();d.execute({operations:[{kind:'grid_update',patch:{interval:120,snapDivisions:1,enabled:true}}]});
 for(const type of ['text','rect','roundedRect','ellipse','diamond','parallelogram','cylinder','document','cloud','web','mermaid','link'] as const){
  const extra=type==='web'||type==='link'?{url:'https://example.com/'}:type==='mermaid'?{mermaidSource:'graph TD; A-->B'}:{};
  d.execute({snap:'desk',operations:[{kind:'add',object:{id:type,type,x:137,y:173,width:368,height:226,...extra}}]});const o=d.get(type);assert.deepEqual([o.x,o.y,o.width,o.height],[120,120,480,240]);
 }
 d.undo();assert.throws(()=>d.get('link'));d.redo();assert.equal(d.get('link').width,480);
});
test('OFF and exact placement preserve dimensions; special parts keep their sizing',()=>{
 const grid={enabled:true,interval:120,snapDivisions:1,origin:{x:0,y:0}};
 for(const type of ['label','clip','file','ruler','wayfinder','prop','line'] as const)assert.deepEqual(newPartGridSize({type,width:73,height:89},grid),{width:73,height:89});
 for(const link of [{deskPath:'/tmp/a.tabletop'},{linkDisplay:'qr' as const}])assert.deepEqual(newPartGridSize({type:'link',width:73,height:89,...link},grid),{width:120,height:120});
 const d=new Desk();d.execute({snap:'desk',operations:[{kind:'grid_update',patch:{enabled:false}},{kind:'add',object:{id:'off',type:'text',width:73,height:89}}]});assert.equal(d.get('off').width,73);
 d.execute({snap:'exact',operations:[{kind:'grid_update',patch:{enabled:true,interval:120,snapDivisions:1}},{kind:'add',object:{id:'exact',type:'text',width:73,height:89}}]});assert.equal(d.get('exact').height,89);
 d.execute({snap:'desk',operations:[{kind:'update',id:'off',patch:{x:240,y:240}}]});assert.deepEqual([d.get('off').width,d.get('off').height],[73,89]);
 assert.deepEqual(newPartGridSize({type:'text',width:75,height:112.5},{...grid,interval:37.5}),{width:75,height:112.5});
});

test('new media and link frames snap without changing originals or doodle coordinates',()=>{
 const d=new Desk();d.execute({operations:[{kind:'grid_update',patch:{interval:120,snapDivisions:1}}]});
 const src='data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"/>');
 const doodle={background:null,offset:{x:0,y:0},strokes:[{tool:'pen' as const,color:'#000000',width:2,points:[{x:10,y:20},{x:30,y:40}]}]};
 const fixtures=[{id:'image',type:'image' as const,src},{id:'svg',type:'svg' as const,src},{id:'doodle',type:'svg' as const,src,doodle},{id:'qr',type:'qrcode' as const,qrText:'test'},{id:'qr-link',type:'link' as const,url:'https://example.com/',linkDisplay:'qr' as const},{id:'desk-link',type:'link' as const,deskPath:'/tmp/a.tabletop'}];
 for(const object of fixtures){d.execute({snap:'desk',operations:[{kind:'add',object:{...object,x:137,y:173,width:368,height:226}}]});const o=d.get(object.id);assert.deepEqual([o.x,o.y,o.width,o.height],[120,120,480,240]);if(object.id==='doodle')assert.deepEqual(o.doodle,doodle);else if('src' in object)assert.equal(o.src,src);}
});
