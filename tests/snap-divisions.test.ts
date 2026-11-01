import {PartClipboard} from '../src/part-clipboard';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Desk} from '../src/model';
import {gridPoint,newPartGridSize} from '../src/grid';
import {snapInterval} from '../src/grid-settings';
import {encodeDeskFile,decodeDeskFile} from '../src/desk-file';
test('snap subdivisions affect positions and new sizes without changing the display interval',async()=>{
 const base={enabled:true,interval:120,origin:{x:0,y:0}};
 for(const snapDivisions of [1,2,3,4]){const grid={...base,snapDivisions},step=120/snapDivisions;assert.equal(snapInterval(grid),step);assert.deepEqual(gridPoint({x:step*1.1,y:step*2.1},grid),{x:step,y:step*2});const size=newPartGridSize({type:'text',width:121,height:121},grid);assert.equal(size.width,Math.ceil(121/step)*step);}
 const d=new Desk();d.execute({operations:[{kind:'grid_update',patch:{interval:120,snapDivisions:2}}]});d.execute({snap:'desk',operations:[{kind:'add',object:{id:'note',type:'text',x:75,y:75,width:368,height:226}}]});assert.deepEqual([d.get('note').x,d.get('note').y,d.get('note').width,d.get('note').height],[60,60,420,240]);
 const data=new Map<string,string>();const cb=new PartClipboard();cb.write({setData:(k,v)=>data.set(k,v),getData:k=>data.get(k)??''},[d.get('note')]);const pasted=cb.paste(d);assert.equal(d.get(pasted[0]).x,d.get('note').x+60);assert.equal(d.get(pasted[0]).width,420);
 const before=d.get('note');d.execute({operations:[{kind:'grid_update',patch:{snapDivisions:4}}]});assert.deepEqual(d.get('note'),before);assert.equal(d.settingsSnapshot().grid.interval,120);const decoded=await decodeDeskFile(await encodeDeskFile(d));assert.equal(decoded.settings.grid.snapDivisions,4);d.undo();assert.equal(d.settingsSnapshot().grid.snapDivisions,2);
 const revision=d.revision;for(const value of [0,5,1.5])assert.throws(()=>d.execute({operations:[{kind:'grid_update',patch:{snapDivisions:value}}]}));assert.equal(d.revision,revision);
});
