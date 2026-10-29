import test from 'node:test';
import assert from 'node:assert/strict';
import {Desk} from '../src/model';
import {encodeDeskFile,decodeDeskFile} from '../src/desk-file';
import {extractFormat,formatPatch} from '../src/format-style';
import {PartClipboard} from '../src/part-clipboard';
import {propertyFieldPatch,propertyValue} from '../src/properties';

test('lines and existing thread data default to zoom-following; fixed width survives copy, archive and Undo',async()=>{
 const d=new Desk();d.execute({operations:[{kind:'add',object:{id:'road',type:'line',x:0,y:0,x2:500,y2:200}},{kind:'label_add',id:'p',seriesId:'series-1',x:0,y:100}]});
 assert.equal(d.get('road').fixedWidth,undefined);assert.equal(propertyValue(d.get('road'),'fixedWidth'),'false');assert.equal(d.settingsSnapshot().series[0].thread.fixedWidth,false);
 d.execute({operations:[{kind:'update',id:'road',patch:propertyFieldPatch('fixedWidth','true',d.get('road'))},{kind:'series_update',id:'series-1',patch:{thread:{fixedWidth:true}}}]});
 assert.equal(d.get('road').fixedWidth,true);assert.equal(d.settingsSnapshot().series[0].thread.fixedWidth,true);
 const style=extractFormat(d.get('road'));assert.equal(style.fixedWidth,true);assert.equal(formatPatch(style,'line').fixedWidth,true);assert.equal('fixedWidth' in formatPatch(style,'rect'),false);
 const clipboard=new PartClipboard(),memory=new Map<string,string>();clipboard.write({setData:(k,v)=>memory.set(k,v),getData:k=>memory.get(k)??''},[d.get('road')]);const [copy]=clipboard.paste(d);assert.equal(d.get(copy).fixedWidth,true);
 const decoded=await decodeDeskFile(await encodeDeskFile(d));assert.equal(decoded.objects.find(o=>o.id==='road')?.fixedWidth,true);assert.equal(decoded.settings.series[0].thread.fixedWidth,true);
 d.undo();d.undo();assert.equal(d.get('road').fixedWidth,undefined);assert.equal(d.settingsSnapshot().series[0].thread.fixedWidth,false);
 assert.throws(()=>d.execute({operations:[{kind:'add',object:{id:'bad',type:'rect',fixedWidth:true}}]}),/only to lines/);
});
