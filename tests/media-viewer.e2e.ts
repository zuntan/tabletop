import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDesk } from './desk-browser';

test('images, SVG and Mermaid open inert snapshots in separate tabs without changing the desk', { timeout: 60_000 }, async () => {
  const { page, call, close, errors, port } = await openTestDesk('media-viewer');
  try {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><script>window.parent.evil=true</script><rect width="300" height="200" fill="red"/></svg>';
    const src = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
    await call('desk_execute', { operations: [
      { kind: 'add', object: { id: 'pic', type: 'image', x: 100, y: 100, width: 300, height: 200, src: png, text: '画像見本', url: `http://127.0.0.1:${port}/missing` } },
      { kind: 'add', object: { id: 'svg', type: 'svg', x: 450, y: 100, width: 300, height: 200, src, text: 'SVG見本' } },
      { kind: 'add', object: { id: 'mermaid', type: 'mermaid', x: 100, y: 350, width: 300, height: 200, text: '図の見本', mermaidSource: 'flowchart LR\n A[Start] --> B[End]' } },
      { kind: 'add', object: { id: 'broken', type: 'mermaid', x: 450, y: 350, width: 300, height: 200, mermaidSource: 'flowchart LR\n A[' } },
    ] });
    const before = await call('desk_state');
    for (const id of ['pic','svg','mermaid']) {
      const button = page.locator(`[data-open-media="${id}"]`);
      const [popup] = await Promise.all([page.waitForEvent('popup'), id === 'svg' ? button.press('Enter') : button.click()]);
      await popup.waitForFunction(() => { const img = document.querySelector('img'); return img?.complete && img.naturalWidth > 0; });
      assert.equal(await popup.evaluate(() => window.opener === null), true);
      assert.equal(await popup.evaluate(() => (window as unknown as {evil?:boolean}).evil === undefined), true);
      assert.equal(await popup.locator('script,svg').count(), 0);
      assert.deepEqual(await call('desk_state'), before);
      if (id === 'mermaid') {
        const snapshot = await popup.locator('img').getAttribute('src');
        await call('desk_execute', { operations: [{ kind: 'update', id, patch: { mermaidSource: 'flowchart LR\n X --> Y' } }] });
        assert.equal(await popup.locator('img').getAttribute('src'), snapshot);
        await call('desk_undo');
      }
      await popup.close();
    }
    assert.equal(await page.locator('[data-open-url="pic"]').count(), 1); // Preserve the existing optional destination.
    const [errorPage] = await Promise.all([page.waitForEvent('popup'), page.locator('[data-open-media="broken"]').click()]);
    await errorPage.waitForFunction(() => document.body.textContent?.includes('図を表示できませんでした'));
    await errorPage.close(); assert.deepEqual(errors, []);
  } finally { await close(); }
});
