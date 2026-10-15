import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Desk, dispatch, objectSchema } from '../src/model';
import { ImageGeometry } from '../src/image-geometry';

const source = 'data:image/png;base64,AA==';
const object = (patch = {}) => objectSchema.parse({ id: 'picture', type: 'image', src: source,
  x: 10, y: 20, width: 400, height: 334, ...patch });
const probe = (width: number, height: number, decode = () => Promise.resolve()) =>
  () => ({ naturalWidth: width, naturalHeight: height, decode }) as unknown as HTMLImageElement;

test('image rectangles separate title, letterbox and natural units; dimensions follow resize', async () => {
  const geometry = new ImageGeometry();
  assert.equal(geometry.describe(object()).imageGeometry?.renderedRect, null);
  geometry.observe([object()], probe(800, 400));
  assert.equal(geometry.describe(object()).imageGeometry?.status, 'loading');
  await new Promise(resolve => setImmediate(resolve));
  const info = geometry.describe(object()).imageGeometry!;
  assert.deepEqual(info.natural, { width: 800, height: 400 });
  assert.deepEqual(info.cardRect, { x: 10, y: 20, width: 400, height: 334 });
  assert.deepEqual(info.viewportRect, { x: 10, y: 54, width: 400, height: 300 });
  assert.deepEqual(info.renderedRect, { x: 10, y: 104, width: 400, height: 200 });
  assert.deepEqual(geometry.describe(object({ width: 100 })).imageGeometry?.renderedRect,
    { x: 10, y: 179, width: 100, height: 50 });
  assert.equal(geometry.describe(object({ height: 34 })).imageGeometry?.status, 'not-displayed');
  info.natural!.width = 1;
  assert.equal(geometry.describe(object()).imageGeometry?.natural?.width, 800);
  const rect = geometry.describe(object()).imageGeometry!.renderedRect!;
  const u = 0.25, v = 0.75;
  assert.equal(((rect.x + u * rect.width) - rect.x) / rect.width * 800, 200);
  assert.equal(((rect.y + v * rect.height) - rect.y) / rect.height * 400, 300);
});

test('replacement never uses old dimensions, including late decoding; errors and SVG remain unknown', async () => {
  const geometry = new ImageGeometry();
  let finish!: () => void;
  geometry.observe([object()], probe(800, 400, () => new Promise<void>(resolve => { finish = resolve; })));
  const replacement = object({ src: 'data:image/png;base64,AQ==' });
  assert.equal(geometry.describe(replacement).imageGeometry?.natural, null);
  geometry.observe([replacement], probe(20, 40));
  finish();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(geometry.describe(replacement).imageGeometry?.natural, { width: 20, height: 40 });
  assert.equal(geometry.describe(object({ type: 'svg' })).imageGeometry?.renderedRect, null);
  assert.equal(geometry.describe(object({ src: 'https://example.org/image' })).imageGeometry?.status, 'remote-unverified');
  geometry.observe([object()], probe(0, 0, () => Promise.reject(new Error('decode'))));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(geometry.describe(object()).imageGeometry?.status, 'error');
  geometry.observe([], probe(1, 1));
  assert.equal(geometry.describe(object()).imageGeometry?.status, 'unobserved');
});

test('read metadata is additive; snapshots and files stay unchanged; no revision or undo changes', async () => {
  const desk = new Desk();
  desk.execute({ operations: [{ kind: 'add', object: object() }] });
  const before = desk.snapshot(), summary = desk.summary();
  desk.imageGeometry.observe(before, probe(800, 400));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(desk.list()[0].imageGeometry?.status, 'ready');
  assert.ok((dispatch(desk, { method: 'get', id: 'picture' }) as any).imageGeometry.renderedRect);
  assert.ok((dispatch(desk, { method: 'context' }) as any).objects[0].imageGeometry.renderedRect);
  assert.deepEqual(desk.snapshot(), before);
  assert.deepEqual(desk.summary(), summary);
  assert.equal('imageGeometry' in desk.get('picture'), false);
});
