import test from 'node:test';
import assert from 'node:assert/strict';
import {Desk} from '../src/model';
import {encodeDeskFile,decodeDeskFile} from '../src/desk-file';
import {plainDeskColors,wallpaperChoice,wallpaperPatch,titleForeground} from '../src/desk-appearance';

test('five pale surfaces reuse plain wallpaper and round-trip with independent title color',async()=>{
 for(const plain of plainDeskColors){
  const desk=new Desk();desk.execute({operations:[{kind:'background_update',patch:{...wallpaperPatch(plain.value),titleBackground:'#dcecf5'}}]});
  assert.equal(desk.settingsSnapshot().background.wallpaper,'none');assert.equal(wallpaperChoice(desk.settingsSnapshot().background),plain.value);
  const restored=await decodeDeskFile(await encodeDeskFile(desk));assert.equal(restored.settings.background.titleBackground,'#dcecf5');assert.equal(restored.settings.background.color,plain.color);
  desk.undo();assert.equal(desk.settingsSnapshot().background.titleBackground,undefined);desk.redo();assert.equal(desk.settingsSnapshot().background.titleBackground,'#dcecf5');
 }
 assert.deepEqual(wallpaperPatch('none'),{wallpaper:'none',color:null});
});
test('title defaults remain unchanged for old files and malformed color changes are atomic',()=>{
 const desk=new Desk();const before=desk.settingsSnapshot();
 for(const titleBackground of ['red','#abc','transparent','url(test)'])assert.throws(()=>desk.execute({operations:[{kind:'background_update',patch:{titleBackground}}]}));
 assert.deepEqual(desk.settingsSnapshot(),before);assert.equal(titleForeground('#ffffff'),'#0f172a');assert.equal(titleForeground('#000000'),'#f8fafc');
 desk.execute({operations:[{kind:'background_update',patch:{titleBackground:'#ffeedd'}}]});desk.execute({operations:[{kind:'background_update',patch:{titleBackground:null}}]});assert.equal(desk.settingsSnapshot().background.titleBackground,null);
});
