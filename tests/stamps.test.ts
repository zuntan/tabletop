import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PartClipboard } from '../src/part-clipboard';
import { Desk } from '../src/model';
import { createStamp, stampPattern, stampPatterns } from '../src/stamp-values';
import { encodeDeskFile, decodeDeskFile } from '../src/desk-file';

test('local press date and all weekday tilts are fixed values; unknown pattern preserves arbitrary text through save and Undo', async () => {
  for (let day = 0; day < 7; day++) {
    const now = new Date(2026, 9, 18 + day, 23, 59);
    const stamp = createStamp('done_ja', true, now);
    assert.equal(stamp.text, `2026.10.${18 + day}`); assert.equal(stamp.angle, -(3 + day));
    assert.equal(createStamp('done_ja', false, now).text, '');
  }
  assert.equal(stampPatterns.length, 16);
  assert.equal(stampPattern('future-design').title, '');
  const desk = new Desk();
  const stamp = { designId: 'future-design', text: '<おかしな文字>🦀', angle: -7 };
  desk.execute({ operations: [{ kind: 'add', object: { id: 'memo', type: 'text', text: 'Memo', stamp } }] });
  assert.deepEqual(desk.list()[0].stamp, stamp);
  const clipboard = new PartClipboard(), data = new Map<string, string>();
  clipboard.write({ setData: (type, value) => { data.set(type, value); }, getData: type => data.get(type) ?? '' }, [desk.get('memo')]);
  const copy = new Desk(); const ids = clipboard.paste(copy); assert.deepEqual(copy.get(ids[0]).stamp, stamp);
  const restored = await decodeDeskFile(await encodeDeskFile(desk));
  assert.deepEqual(restored.objects[0].stamp, stamp);
  desk.execute({ operations: [{ kind: 'update', id: 'memo', patch: { stamp: null } }] });
  assert.equal(desk.get('memo').stamp, null); desk.undo(); assert.deepEqual(desk.get('memo').stamp, stamp);
  assert.throws(() => desk.execute({ operations: [{ kind: 'add', object: { id: 'shape', type: 'rect', stamp } }] }), /text parts only/);
});
