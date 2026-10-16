import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HumanScrollGuard, HUMAN_SCROLL_QUIET_MS, HUMAN_SCROLL_CAMERA_REFUSAL } from '../src/camera-activity';

test('human scrolling blocks camera requests until the last event has been quiet for 400ms', () => {
  let now = 0;
  const guard = new HumanScrollGuard(() => now);
  assert.doesNotThrow(() => guard.assertIdle());
  guard.record();
  assert.throws(() => guard.assertIdle(), { message: HUMAN_SCROLL_CAMERA_REFUSAL });
  now = HUMAN_SCROLL_QUIET_MS - 1;
  assert.throws(() => guard.assertIdle());
  guard.record(); // A continuous wheel/scroll burst extends the quiet period.
  now += HUMAN_SCROLL_QUIET_MS - 1;
  assert.throws(() => guard.assertIdle());
  now++;
  assert.doesNotThrow(() => guard.assertIdle());
});

test('the scroll guard does not queue, schedule or execute rejected actions', () => {
  let now = 0, executions = 0;
  const guard = new HumanScrollGuard(() => now);
  const cameraRequest = () => { guard.assertIdle(); executions++; };
  guard.record();
  for (let i = 0; i < 10; i++) assert.throws(cameraRequest);
  assert.equal(executions, 0);
  now = 1000;
  assert.equal(executions, 0);
  cameraRequest();
  assert.equal(executions, 1);
});
