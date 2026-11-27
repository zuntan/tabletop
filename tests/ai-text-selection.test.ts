import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Desk, dispatch } from '../src/model';
import { textSelectionSchema } from '../src/text-selection-input';

test('AI text selection validates requests and dispatches only to a browser bridge', () => {
  const desk = new Desk();
  const revision = desk.revision;
  const token = '00000000-0000-4000-8000-000000000000';
  for (const input of [
    { action: 'range', id: 'a', start: 0, end: 2 },
    { action: 'range', id: 'a', start: 2, end: 2, contentToken: token },
    { action: 'range', id: 'a', start: .5, end: 2, contentToken: token },
    { action: 'all' }, { action: 'all', id: 'a', start: 0 }, { action: 'clear', id: 'a' },
  ]) assert.equal(textSelectionSchema.safeParse(input).success, false, JSON.stringify(input));
  assert.throws(() => dispatch(desk, { method: 'text_select', action: 'all', id: 'a' }), /compatible browser/);
  const events: unknown[] = [];
  const bridge = { textSelection: { read: (id: string) => { events.push(id); return 'read'; }, select: (input: unknown) => { events.push(input); return 'selected'; } } };
  assert.equal(dispatch(desk, { method: 'text_selection_read', id: 'a' }, undefined, undefined, undefined, undefined, undefined, undefined, bridge), 'read');
  assert.equal(dispatch(desk, { method: 'text_select', action: 'range', id: 'a', start: 0, end: 2, contentToken: token }, undefined, undefined, undefined, undefined, undefined, undefined, bridge), 'selected');
  assert.equal(events.length, 2); assert.equal(desk.revision, revision);
});
