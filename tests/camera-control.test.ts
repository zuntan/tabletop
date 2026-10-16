import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cameraMoveSchema, cameraView, movedCamera } from '../src/camera-control';
import { Desk, dispatch } from '../src/model';

const size = { width: 1000, height: 600 };
const initial = { x: 60, y: 50, zoom: 1 };

test('camera readout converts CSS viewport and translation to world bounds without mutating inputs', () => {
  assert.deepEqual(cameraView(initial, size), {
    center: { x: 440, y: 250 }, zoom: 1, viewport: size,
    visibleBounds: { x: -60, y: -50, width: 1000, height: 600 },
  });
  const zoomed = cameraView({ x: 60, y: 50, zoom: 2 }, size);
  assert.deepEqual(zoomed.center, { x: 220, y: 125 });
  assert.deepEqual(zoomed.visibleBounds, { x: -30, y: -25, width: 500, height: 300 });
  assert.deepEqual(initial, { x: 60, y: 50, zoom: 1 });
  assert.deepEqual(size, { width: 1000, height: 600 });
});

test('camera supports absolute world center and zoom, relative world pan and center-preserving zoom', () => {
  const absolute = movedCamera(initial, size, { center: { x: -300, y: 700 }, zoom: 2 });
  assert.deepEqual(absolute, { camera: { x: 1100, y: -1100, zoom: 2 }, zoomClamped: false });
  const pan = movedCamera(absolute.camera, size, { pan: { x: 100, y: -50 } });
  assert.deepEqual(cameraView(pan.camera, size).center, { x: -200, y: 650 });
  assert.equal(pan.camera.x, absolute.camera.x - 200); // Look right: contents move left.
  const relative = movedCamera(pan.camera, size, { zoomBy: 1.25 });
  assert.equal(relative.camera.zoom, 2.5);
  assert.deepEqual(cameraView(relative.camera, size).center, { x: -200, y: 650 });
  const combined = movedCamera(relative.camera, size, { pan: { x: -100, y: 50 }, zoom: 0.5 });
  assert.deepEqual(cameraView(combined.camera, size).center, { x: -300, y: 700 });
  assert.equal(combined.camera.zoom, 0.5);
  assert.deepEqual(initial, { x: 60, y: 50, zoom: 1 });
});

test('relative zoom clamps at existing UI limits and reports the applied result', () => {
  for (const [zoomBy, zoom] of [[100, 8], [0.01, 0.05]]) {
    const result = movedCamera(initial, size, { zoomBy });
    assert.equal(result.camera.zoom, zoom);
    assert.equal(result.zoomClamped, true);
    assert.deepEqual(cameraView(result.camera, size).center, cameraView(initial, size).center);
  }
});

test('ambiguous, empty, non-finite, unsafe and out-of-range camera requests fail atomically', () => {
  for (const input of [
    {}, { center: { x: 0, y: 0 }, pan: { x: 1, y: 1 } }, { zoom: 2, zoomBy: 2 },
    { zoom: 0 }, { zoom: 9 }, { zoomBy: 0 }, { zoomBy: 101 },
    { zoom: Infinity }, { zoomBy: NaN }, { pan: { x: Infinity, y: 0 } },
    { center: { x: 2_000_001, y: 0 } }, { center: { x: 1 } }, { pan: { x: 1, y: 0, z: 3 } },
    { unexpected: true }, { zoom: '2' },
  ]) {
    assert.equal(cameraMoveSchema.safeParse(input).success, false, JSON.stringify(input));
    assert.throws(() => movedCamera(initial, size, input));
    assert.deepEqual(initial, { x: 60, y: 50, zoom: 1 });
  }
  assert.throws(() => movedCamera(initial, { width: 0, height: 600 }, { zoom: 2 }), /unavailable/);
  assert.throws(() => cameraView({ ...initial, zoom: 0 }, size), /unavailable/);
});

test('dispatch validates before invoking the camera bridge and leaves the desk untouched', () => {
  const desk = new Desk();
  const before = dispatch(desk, { method: 'state' });
  let moves = 0;
  const bridge = { get: () => cameraView(initial, size), move: (input: unknown) => { moves++; return movedCamera(initial, size, input); } };
  assert.deepEqual(dispatch(desk, { method: 'camera_get' }, bridge), cameraView(initial, size));
  assert.throws(() => dispatch(desk, { method: 'camera_move' }, bridge));
  assert.throws(() => dispatch(desk, { method: 'camera_move', zoom: 2, zoomBy: 2 }, bridge));
  assert.throws(() => dispatch(desk, { method: 'camera_move', zoom: 2, unknown: true }, bridge));
  assert.equal(moves, 0);
  dispatch(desk, { method: 'camera_move', zoomBy: 1.25 }, bridge);
  assert.equal(moves, 1);
  assert.deepEqual(dispatch(desk, { method: 'state' }), before);
  assert.throws(() => dispatch(desk, { method: 'camera_get' }), /unavailable/);
});
