import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';

test('MCP exposes browser-decoded image geometry without editing the desk', async () => {
  const desk = await openTestDesk('image-geometry');
  try {
    const src = await desk.page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 400;
      canvas.getContext('2d')!.fillRect(0, 0, 800, 400);
      return canvas.toDataURL('image/png');
    });
    await desk.call('desk_execute', { operations: [{ kind: 'add', object: {
      id: 'image', type: 'image', src, x: 10, y: 20, width: 400, height: 334,
    } }] });
    let info;
    for (let attempt = 0; attempt < 50; attempt++) {
      info = (await desk.call('desk_get', { id: 'image' })).imageGeometry;
      if (info.status === 'ready') break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.equal(info.status, 'ready');
    assert.deepEqual(info.renderedRect, { x: 10, y: 104, width: 400, height: 200 });
    const context = await desk.call('desk_context');
    assert.deepEqual(context.objects[0].imageGeometry, info);
    assert.equal(context.revision, 1);
    await desk.call('desk_execute', { operations: [{ kind: 'update', id: 'image', patch: { width: 100 } }] });
    assert.equal((await desk.call('desk_get', { id: 'image' })).imageGeometry.renderedRect.width, 100);
    await desk.call('desk_execute', { operations: [{ kind: 'update', id: 'image', patch: { src: 'data:image/png;base64,AA==' } }] });
    assert.equal((await desk.call('desk_get', { id: 'image' })).imageGeometry.renderedRect, null);
    assert.deepEqual(desk.errors, []);
  } finally { await desk.close(); }
});
