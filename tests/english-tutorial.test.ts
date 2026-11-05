import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {decodeDeskFile} from '../src/desk-file';

test('English tutorial preserves the Japanese layout and references with separate content',async()=>{
 const ja=await decodeDeskFile(await readFile('docs/tabletop/tabletop-guide.tabletop'));
 const en=await decodeDeskFile(await readFile('docs/tabletop/tabletop-guide-en.tabletop'));
 assert.equal(en.warnings.length,0);
 assert.deepEqual(en.objects.map(o=>o.id),ja.objects.map(o=>o.id));
 const overrides=JSON.parse(await readFile('scripts/data/tutorial-en.json','utf8'));
 const content=new Set(['text','description','mermaidSource','src','deskPath']);
 for(let i=0;i<ja.objects.length;i++){
  const geometry=(o:typeof ja.objects[number])=>Object.fromEntries(Object.entries(o).filter(([k])=>!content.has(k)));
  assert.deepEqual(geometry(en.objects[i]),geometry({...ja.objects[i],...overrides[ja.objects[i].id]}),en.objects[i].id);
  for(const key of ['text','description','mermaidSource'] as const)assert.doesNotMatch(en.objects[i][key]??'',/[\u3040-\u9fff]/,`${en.objects[i].id}.${key}`);
 }
 assert.equal(en.settings.initialFocusId,ja.settings.initialFocusId);
 assert.deepEqual(en.settings.series.map(s=>s.id),ja.settings.series.map(s=>s.id));
 assert.equal(en.objects.filter(o=>o.type==='mermaid').length,3);
 const area=en.objects.find(o=>o.id==='guide-sample-prop-area')!;
 assert.match(Buffer.from(area.src!.split(',')[1],'base64').toString(),/TEMP AREA/);
 assert.match(en.objects.find(o=>o.id==='tool-detail-stamp')!.text,/38 stamps/);
 assert.match(en.objects.find(o=>o.id==='tool-detail-sticker')!.text,/strips 1 and 2/);
 assert.ok(en.objects.filter(o=>o.stamp?.designId.endsWith('_ja')).length>0);
});
