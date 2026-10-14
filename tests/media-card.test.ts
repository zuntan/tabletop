import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Desk } from '../src/model';

test('media URLs are optional and clearable while web and link URLs remain required', () => {
  const desk = new Desk();
  desk.execute({ operations: [{ kind: 'add', object: { id: 'image', type: 'image', src: 'data:image/png;base64,AA==' } }] });
  desk.execute({ operations: [{ kind: 'update', id: 'image', patch: { text: 'Title', url: 'https://example.com/' } }] });
  assert.equal(desk.get('image').url, 'https://example.com/');
  desk.execute({ operations: [{ kind: 'update', id: 'image', patch: { url: '' } }] });
  assert.equal(desk.get('image').url, '');
  desk.undo(); assert.equal(desk.get('image').url, 'https://example.com/');
  desk.redo(); assert.equal(desk.get('image').url, '');
  assert.throws(() => desk.execute({ operations: [{ kind: 'update', id: 'image', patch: { url: 'javascript:alert(1)' } }] }));
  for (const type of ['link', 'web'] as const) {
    assert.throws(() => desk.execute({ operations: [{ kind: 'add', object: { id: type, type, url: '' } }] }));
    desk.execute({ operations: [{ kind: 'add', object: { id: type, type, url: 'https://example.com/' } }] });
    assert.throws(() => desk.execute({ operations: [{ kind: 'update', id: type, patch: { url: '' } }] }));
    assert.equal(desk.get(type).url, 'https://example.com/');
  }
});
