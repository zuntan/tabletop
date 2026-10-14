import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Desk, dispatch } from '../src/model';
import { deskContext } from '../src/desk-context';

test('semantic context recognizes bindings, numbered series and paged history without image payloads', () => {
  const desk = new Desk();
  desk.execute({ operations: [
    { kind: 'add', object: { id: 'shape', type: 'rect', x: 0, y: 0 } },
    { kind: 'label_add', id: 'pin', seriesId: 'series-1', x: 250, y: 0 },
    { kind: 'add', object: { id: 'image', type: 'image', src: 'data:image/png;base64,AA==' } },
    { kind: 'add', object: { id: 'arrow', type: 'arrow', startBinding: { objectId: 'shape', anchor: 'right' }, endBinding: { objectId: 'pin', anchor: 'left' } } },
  ] });
  desk.execute({ operations: [{ kind: 'update', id: 'shape', patch: { x: 40 } }] });
  const context = deskContext(desk, 0, 1);
  assert.equal(context.revision, 2); assert.equal(context.history.hasMore, true);
  assert.equal(context.history.nextRevision, 1);
  assert.equal(context.connections[0].start.binding?.objectId, 'shape');
  assert.equal(context.connections[0].start.x, 220);
  assert.deepEqual(context.settings.series[0].members, [{ id: 'pin', number: 1, text: '1', description: '' }]);
  assert.equal(context.settings.series[0].next, 2);
  assert.ok(!JSON.stringify(context).includes('AA=='));
  assert.deepEqual(dispatch(desk, { method: 'context', limit: 1 }), context);
});
