import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectionGuidance } from '../src/connection-guidance';

test('closed acceptance asks about intent instead of unconditionally opening or presenting a URL', () => {
  const guidance = connectionGuidance(false, 'waiting-for-AI');
  assert.equal(guidance.bootstrapReady, false);
  assert.deepEqual(guidance.nextAction, { kind: 'ask-user', topic: 'new-or-manual-pairing-vs-recovery' });
  assert.match(guidance.message, /Do not present the URL/);
  assert.match(guidance.message, /obtain user approval/);
  assert.match(guidance.message, /desk_pairing_restore/);
  assert.match(guidance.message, /record is lost/);
});

test('open acceptance directs browser connection and verification, not claims of success', () => {
  const guidance = connectionGuidance(false, 'new-pairing-open');
  assert.equal(guidance.bootstrapReady, true);
  assert.deepEqual(guidance.nextAction, { kind: 'browser-connect', verifyWith: 'desk_connection_info' });
  assert.match(guidance.message, /no browser is connected yet/);
  assert.match(guidance.message, /browserConnected:true/);
});

test('registered credentials without a browser wait for reconnection without automatic replacement', () => {
  const guidance = connectionGuidance(false, 'paired');
  assert.equal(guidance.bootstrapReady, false);
  assert.deepEqual(guidance.nextAction, { kind: 'wait-for-browser', verifyWith: 'desk_connection_info' });
  assert.match(guidance.message, /Do not open new acceptance automatically/);
});

test('a connected browser directs private record retention then a fresh desk read', () => {
  const guidance = connectionGuidance(true, 'paired');
  assert.equal(guidance.bootstrapReady, false);
  assert.deepEqual(guidance.nextAction, { kind: 'call-tool', tool: 'desk_pairing_info' });
  assert.match(guidance.message, /privately/);
  assert.match(guidance.message, /desk_summary or desk_context/);
});
