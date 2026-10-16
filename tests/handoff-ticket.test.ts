import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HandoffTicket } from '../src/handoff-ticket';

test('handoff tickets expire, rotate, clear and bind to acceptance epochs', () => {
  let now = 0;
  const tickets = new HandoffTicket(() => now);
  const first = tickets.issue(3);
  assert.equal(tickets.allows(first, 3), true);
  assert.equal(tickets.allows(first, 4), false);
  assert.equal(tickets.allows(null, 3), false);
  assert.equal(tickets.allows('wrong', 3), false);
  now = 300_000;
  assert.equal(tickets.allows(first, 3), false);
  const second = tickets.issue(4);
  assert.notEqual(first, second);
  assert.equal(tickets.allows(first, 3), false);
  assert.equal(tickets.allows(second, 4), true);
  tickets.clear();
  assert.equal(tickets.allows(second, 4), false);
});
