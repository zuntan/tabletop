import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDesk } from './desk-browser';

test('browser raster captures pointed Markdown and stamp to transparent PNG without editing', { timeout: 30000 }, async () => {
  const { page, call, client, close } = await openTestDesk('part-raster');
  try {
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'raster-card', type: 'text', x: 100, y: 100, width: 400, height: 260,
      fill: '#ffffff', fillOpacity: 1, text: '# 日本語ラスタ\n**太字**と本文\n- 項目', fontSize: 24, padding: 20,
      stamp: { designId: 'done_ja', text: '2026.10.21', angle: -4 },
      stickers: { colors: Array(20).fill('#3b82f6'), origin: 'bottom-left', diameter: 36, fixed: false } } }] });
    await call('desk_point', { ids: ['raster-card'] });
    const before = await call('desk_summary');
    const result = await client.callTool({ name: 'desk_raster', arguments: { scale: 1 } });
    assert.notEqual(result.isError, true, JSON.stringify(result));
    const content = result.content as { type: string; text?: string; data?: string }[];
    const meta = JSON.parse(content[0].text!);
    assert.ok(meta.bounds.y < 100); // Bottom-origin rows extend upward, and the corner circle extends left.
    assert.ok(meta.bounds.x < 100);
    assert.equal(meta.revision, before.revision); assert.equal(meta.id, 'raster-card');
    const png = content.find(c => c.type === 'image') as { data: string };
    const dataUrl = `data:image/png;base64,${png.data}`;
    const pixels = await page.evaluate(async src => {
      const image = new Image(); image.src = src; await image.decode();
      const c = document.createElement('canvas'); c.width = image.width; c.height = image.height;
      const ctx = c.getContext('2d')!; ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let dark = 0, red = 0, transparent = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (!data[i + 3]) transparent++;
        if (data[i+3] > 100 && data[i] < 100 && data[i+1] < 100 && data[i+2] < 100) dark++;
        if (data[i+3] > 100 && data[i] > 150 && data[i+1] < 130) red++;
      }
      return { dark, red, transparent };
    }, dataUrl);
    assert.ok(pixels.dark > 200, JSON.stringify(pixels)); assert.ok(pixels.red > 200); assert.ok(pixels.transparent > 0);
    assert.equal((await call('desk_summary')).revision, before.revision);
    await call('desk_asset_import', { id: 'raster-copy', source: { path: meta.path }, x: 600, y: 100, width: meta.width, height: meta.height + 34 });
    assert.equal((await call('desk_get', { id: 'raster-copy' })).type, 'image');
    await call('desk_execute', { operations: [
      { kind: 'add', object: { id: 'mold', type: 'rect', x: 120, y: 120, width: 100, height: 100 } },
      { kind: 'cutout', id: 'raster-card', moldId: 'mold' },
    ] });
    const clipped = await client.callTool({ name: 'desk_raster', arguments: { scale: 1 } });
    assert.notEqual(clipped.isError, true);
    const clippedMeta = JSON.parse((clipped.content as {text:string}[])[0].text);
    assert.ok(clippedMeta.height > 250, JSON.stringify({height:clippedMeta.height,bounds:clippedMeta.bounds})); // Wrapped stickers outside the 100px window remain in the capture.
  } finally { await close(); }
});
