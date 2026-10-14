import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Desk, objectSchema } from '../src/model';
import { facingAnchor, selectedConnection } from '../src/connection-creation';

const object = (id: string, type: 'rect' | 'text' | 'ellipse' = 'rect', x = 0, y = 0) => objectSchema.parse({ id, type, x, y, width: 100, height: 80 });
test('selection creation chooses facing sides for horizontal, vertical and coincident centers', () => {
  const a = object('a'), right = object('right', 'text', 250), below = object('below', 'ellipse', 0, 200);
  assert.equal(facingAnchor(a, { x: 500, y: 40 }), 'right');
  assert.deepEqual(selectedConnection([a, right]).startBinding, { objectId: 'a', anchor: 'right' });
  assert.deepEqual(selectedConnection([a, right]).endBinding, { objectId: 'right', anchor: 'left' });
  assert.equal(selectedConnection([a, below]).startBinding?.anchor, 'bottom');
  assert.equal(selectedConnection([a, below]).endBinding?.anchor, 'top');
  assert.equal(selectedConnection([below, a]).startBinding?.anchor, 'top');
  assert.equal(selectedConnection([a, object('overlap')]).endBinding?.anchor, 'left');
  assert.deepEqual(selectedConnection([]), {});
  assert.deepEqual(selectedConnection([a, right, below]), {});
  const one = selectedConnection([a]);
  assert.equal(one.endBinding, null); assert.equal(one.x2, 220); assert.equal(one.y2, 40);
});
test('Markdown memo connections follow movement/resizing and share Undo and deletion detachment', () => {
  const desk = new Desk(); const a = object('memo', 'text'), b = object('shape', 'rect', 250);
  desk.execute({ operations: [{ kind: 'add', object: a }, { kind: 'add', object: b },
    { kind: 'add', object: { id: 'edge', type: 'arrow', ...selectedConnection([a, b]) } }] });
  desk.execute({ operations: [{ kind: 'update', id: 'memo', patch: { x: 30, width: 140, height: 160 } }] });
  assert.equal(desk.get('edge').x, 170); assert.equal(desk.get('edge').y, 80);
  desk.undo(); assert.equal(desk.get('edge').x, 100);
  desk.execute({ operations: [{ kind: 'delete', id: 'memo' }] });
  assert.equal(desk.get('edge').startBinding, null); assert.equal(desk.get('edge').x, 100);
  desk.undo(); assert.equal(desk.get('edge').startBinding?.objectId, 'memo');
});
