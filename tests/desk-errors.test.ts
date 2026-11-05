import test from 'node:test';
import assert from 'node:assert/strict';
import { DeskError } from '../src/desk-errors';
import { uiErrorMessage } from '../src/i18n/errors';
import { getUiLanguage, setUiLanguage } from '../src/i18n';

test('shared diagnostics stay English while UI rendering follows the chosen language',async()=>{
 const original=getUiLanguage();
 try{
  await setUiLanguage('ja');
  const error=new DeskError('fileEmpty');
  assert.equal(error.message,'Cannot create an empty clear folder.');
  assert.equal(uiErrorMessage(error),'空のクリアファイルは作成できません');
  await setUiLanguage('en');
  assert.equal(error.message,'Cannot create an empty clear folder.');
  assert.equal(uiErrorMessage(error),'Cannot create an empty clear folder.');
 }finally{await setUiLanguage(original);}
});

test('diagnostic values are copied and internal hints do not change Error serialization',()=>{
 const values={extension:'.tabletop'};const error=new DeskError('storePathExtension',values);values.extension='.png';
 assert.equal(error.message,'Use a .tabletop file path for the save target.');
 assert.equal(uiErrorMessage(error,'ja'),'保存先には.tabletopファイルのパスを指定してください');
 assert.equal(error.values.extension,'.tabletop');
 assert.equal(JSON.stringify(error),JSON.stringify(new Error('original')));
});

test('string-only transport diagnostics are translated only when the complete static message is known',()=>{
 const error=new DeskError('fileEmpty');
 assert.equal(uiErrorMessage(new Error(error.message),'ja'),'空のクリアファイルは作成できません');
 assert.equal(uiErrorMessage('An unrelated error','ja'),'An unrelated error');
 const dynamic=new DeskError('deskFetchStatus',{status:404});
 assert.equal(uiErrorMessage(dynamic,'ja'),'机を取得できませんでした（HTTP 404）');
 assert.equal(uiErrorMessage(new Error(dynamic.message),'ja'),dynamic.message);
});
