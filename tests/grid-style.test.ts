import test from 'node:test';
import assert from 'node:assert/strict';
import {Desk} from '../src/model';
import {encodeDeskFile,decodeDeskFile} from '../src/desk-file';
test('grid style/color persist independently of origin axes and invalid styles are atomic',async()=>{
 const desk=new Desk();desk.execute({operations:[{kind:'background_update',patch:{originAxes:true,originAxesColor:'#112233',gridColor:'#445566',gridStyle:'lines',showGrid:true}},{kind:'grid_update',patch:{enabled:false,interval:72}}]});
 const decoded=await decodeDeskFile(await encodeDeskFile(desk));assert.equal(decoded.settings.background.originAxesColor,'#112233');assert.equal(decoded.settings.background.gridColor,'#445566');assert.equal(decoded.settings.background.gridStyle,'lines');assert.equal(decoded.settings.grid.enabled,false);assert.equal(decoded.settings.grid.interval,72);
 const revision=desk.revision;assert.throws(()=>desk.execute({operations:[{kind:'background_update',patch:{gridStyle:'invalid' as any}}]}));assert.equal(desk.revision,revision);
 desk.undo();assert.equal(desk.settingsSnapshot().background.gridStyle,undefined);desk.redo();assert.equal(desk.settingsSnapshot().background.gridStyle,'lines');
});
