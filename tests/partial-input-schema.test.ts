import test from 'node:test';
import assert from 'node:assert/strict';
import {Desk, batchSchema} from '../src/model';

test('partial creation and update inputs preserve omitted fields under Zod 4', () => {
  const batch = batchSchema.parse({operations:[
    {kind:'add',object:{id:'note',type:'text'}},
    {kind:'update',id:'note',patch:{x:123}},
    {kind:'background_update',patch:{originAxes:true}},
    {kind:'series_update',id:'series-1',patch:{thread:{visible:true}}},
  ]});
  assert.deepEqual(batch.operations, [
    {kind:'add',object:{id:'note',type:'text'}},
    {kind:'update',id:'note',patch:{x:123}},
    {kind:'background_update',patch:{originAxes:true}},
    {kind:'series_update',id:'series-1',patch:{thread:{visible:true}}},
  ]);
  const desk = new Desk();
  desk.execute({operations:[
    {kind:'defaults_update',patch:{fill:'#abcdef',fontSize:42}},
    {kind:'add',object:{id:'note',type:'text',text:'保持する本文',width:444}},
    {kind:'series_update',id:'series-1',patch:{thread:{color:'#123456',width:6}}},
  ]});
  desk.execute({operations:batch.operations.slice(1)});
  const note=desk.get('note');
  assert.equal(note.text,'保持する本文');assert.equal(note.width,444);
  assert.equal(note.fill,'#abcdef');assert.equal(note.fontSize,42);
  assert.equal(note.x,123);
  const thread=desk.settingsSnapshot().series[0].thread;
  assert.equal(thread.color,'#123456');assert.equal(thread.width,6);assert.equal(thread.visible,true);
});
