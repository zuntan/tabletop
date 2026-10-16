import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CameraAnimator, cameraFlight, type FrameScheduler } from '../src/camera-animation';
import { cameraMoveSchema, cameraView } from '../src/camera-control';

const size = { width: 1000, height: 600 };
const from = { x: 500, y: 300, zoom: 1 };
const to = { x: -9500, y: 300, zoom: 1 };
function scheduler() {
  let id = 0;
  const frames = new Map<number, (time: number) => void>();
  const timers = new Map<number, () => void>();
  const api: FrameScheduler = {
    request: callback => { frames.set(++id, callback); return id; },
    cancel: id => { frames.delete(id); },
    timeout: callback => { timers.set(++id, callback); return id as unknown as ReturnType<typeof setTimeout>; },
    clearTimeout: id => { timers.delete(id as unknown as number); },
  };
  return { api, frames, timers, tick(time: number) { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(time)); } };
}

test('flight uses screen distance, pulls back on long jumps, eases and lands exactly', () => {
  const flight = cameraFlight(from, to, size);
  assert.ok(flight.durationMs >= 500 && flight.durationMs <= 900);
  assert.deepEqual(flight.at(0), from); assert.deepEqual(flight.at(1), to);
  assert.ok(flight.at(0.5).zoom < 1);
  const middle = cameraView(flight.at(0.5), size);
  assert.ok(Math.abs(middle.center.x - 5000) < 0.001);
  const near = cameraFlight(from, { ...from, x: 450 }, size);
  assert.ok(near.durationMs >= 250 && near.durationMs < 350);
  assert.ok(near.durationMs < flight.durationMs);
  const scaled = cameraFlight({ x: 500, y: 300, zoom: 2 }, { x: -9500, y: 300, zoom: 2 }, size);
  assert.equal(scaled.durationMs, flight.durationMs);
  assert.equal(cameraFlight(from, from, size).durationMs, 0);
  for (let i = 0; i <= 100; i++) {
    const value = cameraFlight(from, { x: -2e6, y: 2e6, zoom: 8 }, size).at(i / 100);
    assert.ok(Object.values(value).every(Number.isFinite));
    assert.ok(value.zoom >= 0.05 && value.zoom <= 8);
  }
});

test('animation duration is validated and does not count as a movement field', () => {
  for (const input of [{ durationMs: 200 }, { pan: { x: 1, y: 0 }, durationMs: -1 }, { zoom: 1, durationMs: 2001 }, { zoom: 1, durationMs: Infinity }]) {
    assert.equal(cameraMoveSchema.safeParse(input).success, false);
  }
  assert.equal(cameraMoveSchema.safeParse({ zoom: 1, durationMs: 0 }).success, true);
  assert.equal(cameraFlight(from, to, size, { durationMs: 123 }).durationMs, 123);
});

test('frame timestamps drive interpolation and completion cleans all scheduled work', async () => {
  const clock = scheduler(), animator = new CameraAnimator(clock.api);
  let view = from;
  const done = animator.run(from, to, size, value => { view = value; }, { durationMs: 400 });
  clock.tick(1000); assert.deepEqual(view, from);
  clock.tick(1200); assert.notDeepEqual(view, from); assert.notDeepEqual(view, to);
  clock.tick(2000); await done; assert.deepEqual(view, to);
  assert.equal(clock.frames.size, 0); assert.equal(clock.timers.size, 0);
});

test('human cancellation freezes current frame, rejects once and never replays', async () => {
  const clock = scheduler(), animator = new CameraAnimator(clock.api);
  let view = from;
  const done = animator.run(from, to, size, value => { view = value; });
  const rejected = assert.rejects(done, /Human input.*do not retry automatically/);
  clock.tick(0); clock.tick(100);
  const stopped = { ...view };
  animator.cancel('Human input'); await rejected;
  clock.tick(5000); animator.cancel();
  assert.deepEqual(view, stopped); assert.notDeepEqual(view, to);
  assert.equal(clock.frames.size, 0); assert.equal(clock.timers.size, 0);
});

test('superseding and background deadlines settle without stale frames; instant applies immediately', async () => {
  const clock = scheduler(), animator = new CameraAnimator(clock.api);
  let view = from;
  const first = animator.run(from, to, size, value => { view = value; });
  const rejected = assert.rejects(first, /Superseded/);
  clock.tick(0); clock.tick(100);
  const second = animator.run(view, from, size, value => { view = value; });
  await rejected;
  const timedOut = assert.rejects(second, /deadline/);
  [...clock.timers.values()].forEach(callback => callback()); await timedOut;
  const stopped = { ...view }; clock.tick(10000); assert.deepEqual(view, stopped);
  await animator.run(view, to, size, value => { view = value; }, { durationMs: 0 });
  assert.deepEqual(view, to); assert.equal(clock.frames.size, 0); assert.equal(clock.timers.size, 0);
});
