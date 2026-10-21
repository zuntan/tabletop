import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Desk } from '../src/model';
import { extractFormat, formatPatch, readFormatMemory } from '../src/format-style';

test('format snapshots preserve meaningful styles only and cross-type application keeps content, geometry and relationships', () => {
  const desk = new Desk();
  desk.execute({ operations: [
    { kind: 'add', object: { id: 'source', type: 'text', fontSize: 48, padding: 30, fill: '#ffeeaa', cornerRadius: 40, stamp: { designId: 'done_ja', text: '', angle: 0 } } },
    { kind: 'add', object: { id: 'target', type: 'text', text: 'Keep me', x: 120, width: 300, locked: true, reactions: ['👍'] } },
    { kind: 'add', object: { id: 'line', type: 'line', x: 1, y: 2, x2: 100, y2: 50, startMarker: 'circle', endMarker: 'arrow', dash: 'dotted', junctionRounding: 192 } },
  ] });
  const style = extractFormat(desk.get('source'));
  assert.equal(style.fontSize, 48); assert.equal(style.padding, 30); assert.equal('stamp' in style, false); assert.equal('width' in style, false);
  desk.execute({ operations: [{ kind: 'update', id: 'target', patch: formatPatch(style, 'text') }] });
  const target = desk.get('target'); assert.equal(target.fontSize, 48); assert.equal(target.text, 'Keep me'); assert.equal(target.x, 120); assert.equal(target.width, 300); assert.equal(target.locked, true); assert.deepEqual(target.reactions, ['👍']);
  const line = extractFormat(desk.get('line')); assert.equal(line.endMarker, 'arrow'); assert.equal(line.junctionRounding, 192); assert.equal('x2' in line, false);
  assert.deepEqual(formatPatch(line, 'text'), { stroke: '#334155', strokeWidth: 2 });
  assert.deepEqual(formatPatch(style, 'image'), {});
  desk.execute({ operations: [{ kind: 'add', object: { id: 'legacy', type: 'rect' } }, { kind: 'add', object: { id: 'auto', type: 'rect', textFit: 'auto' } }] });
  desk.execute({ operations: [{ kind: 'update', id: 'auto', patch: formatPatch(extractFormat(desk.get('legacy')), 'rect') }] });
  assert.equal(desk.get('auto').textFit, undefined);
});

test('browser format memory validates imported local values and preserves three independent snapshots', () => {
  const memory = readFormatMemory(JSON.stringify({ current: { fontSize: 40 }, slots: [{ stroke: '#ff0000' }, { dash: 'dashed' }, null] }));
  assert.equal(memory.current.fontSize, 40); assert.equal(memory.slots[1]?.dash, 'dashed');
  assert.deepEqual(readFormatMemory('{broken').slots, [null,null,null]);
  assert.deepEqual(readFormatMemory(JSON.stringify({ current: { width: 400 }, slots: [null,null,null] })).current, {});
});
