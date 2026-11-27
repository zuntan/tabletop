import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDesk } from './desk-browser';

test('long press selects rendered Markdown without editing, and preserves ranges through mouse camera movement', { timeout: 45_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('text-selection');
  try {
    const source = '# Reading card\n\nAlpha beta gamma delta.\n\nSecond paragraph.\n\n- [ ] Task\n\n[Link](https://example.com/)';
    await call('desk_execute', { operations: [
      { kind: 'add', object: { id: 'memo', type: 'text', x: 100, y: 100, width: 600, height: 440, text: source, fontSize: 24 } },
      { kind: 'add', object: { id: 'other', type: 'text', x: 780, y: 100, width: 300, height: 200, text: 'Other card' } },
    ] });
    const body = page.locator('[data-id="memo"] .markdown-text');
    const paragraph = body.locator('p').first();
    const start = (await paragraph.boundingBox())!;
    await page.mouse.move(start.x + 20, start.y + 12); await page.mouse.down();
    await page.waitForFunction(() => document.querySelector('#canvas')?.getAttribute('data-text-selection') === 'memo');
    await page.mouse.up();
    assert.equal(await body.getAttribute('data-text-selection'), 'active');
    const before = await call('desk_state');
    // Select real rendered text with the mouse, rather than editing Markdown source.
    await page.mouse.move(start.x + 2, start.y + 12); await page.mouse.down();
    await page.mouse.move(start.x + 150, start.y + 12, { steps: 8 }); await page.mouse.up();
    const selected = await page.evaluate(() => getSelection()?.toString());
    assert.ok(selected?.includes('Alpha'), JSON.stringify(selected));
    const copied = await page.evaluate(() => {
      const data = new DataTransfer(); window.dispatchEvent(new ClipboardEvent('copy', { clipboardData: data, bubbles: true, cancelable: true }));
      return { text: data.getData('text/plain'), types: [...data.types] };
    });
    assert.equal(copied.text, selected); assert.deepEqual(copied.types, ['text/plain']);
    await page.keyboard.press('Delete'); await page.keyboard.press('Backspace');
    await page.keyboard.press('Control+x'); await page.keyboard.press('Control+v');
    assert.deepEqual((await call('desk_state')).objects, before.objects);
    assert.equal((await call('desk_summary')).revision, before.revision);
    const cameraBefore = await call('desk_camera_get');
    await page.mouse.move(start.x + 250, start.y + 40); await page.mouse.down({ button: 'middle' });
    await page.mouse.move(start.x + 300, start.y + 70, { steps: 5 }); await page.mouse.up({ button: 'middle' });
    assert.notDeepEqual(await call('desk_camera_get'), cameraBefore);
    assert.equal(await page.evaluate(() => getSelection()?.toString()), selected);
    await page.mouse.wheel(0, -100);
    await page.waitForFunction(zoom => document.querySelector('#zoom-reset .tool-icon')?.textContent !== zoom, `${Math.round(cameraBefore.zoom * 100)}%`);
    assert.equal(await page.evaluate(() => getSelection()?.toString()), selected);
    await page.keyboard.press('Control+a');
    const all = await page.evaluate(() => getSelection()?.toString());
    assert.ok(all?.includes('Reading card') && all.includes('Second paragraph.'));
    assert.ok(!all?.includes('Other card'));
    const popupCount = page.context().pages().length;
    await body.locator('a').click();
    assert.equal(page.context().pages().length, popupCount);
    await body.locator('input').click();
    assert.equal((await call('desk_get', { id: 'memo' })).text, source);
    await body.locator('h1').dblclick();
    assert.equal(await page.locator('[data-inline-text]').count(), 0);
    await page.keyboard.press('Escape');
    assert.equal(await body.getAttribute('data-text-selection'), null);
    assert.equal(await page.evaluate(() => getSelection()?.toString()), '');
    // A short drag remains a normal geometry edit, not a delayed text mode.
    const heading = (await body.locator('h1').boundingBox())!;
    await page.mouse.move(heading.x + 20, heading.y + 15); await page.mouse.down();
    await page.mouse.move(heading.x + 100, heading.y + 15, { steps: 5 }); await page.mouse.up();
    assert.notEqual((await call('desk_get', { id: 'memo' })).x, 100);
    assert.equal(await body.getAttribute('data-text-selection'), null);
    // Long press again, then leave by clicking another card.
    await body.locator('p').first().hover(); await page.mouse.down();
    await page.waitForFunction(() => document.querySelector('#canvas')?.hasAttribute('data-text-selection'));
    await page.mouse.up();
    await page.locator('[data-id="other"] .markdown-text').click();
    assert.equal(await body.getAttribute('data-text-selection'), null);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('touch long press enters read-only selection and blocks camera gestures until an outside tap', { timeout: 30_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('text-selection-touch');
  try {
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'memo', type: 'text', x: 100, y: 100, width: 600, height: 400, text: 'Touch selection\n\nRead and copy this text.' } }] });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    const box = (await page.locator('[data-id="memo"] p').first().boundingBox())!;
    const touch = { x: box.x + 30, y: box.y + 10 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch] });
    await page.waitForFunction(() => document.querySelector('#canvas')?.getAttribute('data-text-selection') === 'memo');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const before = await call('desk_camera_get');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touch.x + 100, y: touch.y + 60 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.mouse.move(touch.x, touch.y); await page.mouse.wheel(0, -100);
    assert.deepEqual(await call('desk_camera_get'), before);
    assert.equal((await call('desk_get', { id: 'memo' })).x, 100);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touch.x + 650, y: touch.y + 450 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await page.locator('#canvas').getAttribute('data-text-selection'), null);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('selected links, images and task markers copy as notation while partial links, tables and emphasis stay plain', { timeout: 30_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('text-selection-copy');
  try {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="red"/></svg>';
    await page.route('https://example.com/image.png', route => route.fulfill({ contentType: 'image/svg+xml', body: svg }));
    const source = '# Copy sample\n\nA **bold** word and [**Label** text](https://example.com/path?a=1&b=2).\n\n- [ ] Pending\n- [x] Done\n\n| Name | Value |\n| --- | --- |\n| Alpha | Beta |\n\n![Example](tabletop://./picture)\n\n![Missing](tabletop://./absent)\n\n![External](https://example.com/image.png)\n\n`[ ] code stays code`';
    await call('desk_execute', { operations: [
      { kind: 'add', object: { id: 'picture', type: 'svg', src: 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64'), x: 900, y: 100 } },
      { kind: 'add', object: { id: 'memo', type: 'text', text: source, x: 50, y: 20, width: 700, height: 1100 } },
    ] });
    await page.waitForFunction(() => document.querySelectorAll('[data-id="memo"] [data-image-status="ready"]').length === 2);
    const body = page.locator('[data-id="memo"] .markdown-text');
    await body.locator('h1').hover(); await page.mouse.down();
    await page.waitForFunction(() => document.querySelector('#canvas')?.hasAttribute('data-text-selection'));
    await page.mouse.up();
    const revision = (await call('desk_summary')).revision;
    async function copy(selector: string, kind: 'node' | 'contents' | 'partial' | 'exact-label' = 'contents') {
      return page.evaluate(({ selector, kind }) => {
        const host = document.querySelector('[data-id="memo"] .markdown-text')!;
        const element = host.querySelector(selector)!;
        const range = document.createRange();
        if (kind === 'node') range.selectNode(element);
        else if (kind === 'partial') { const text = element.querySelector('strong')!.firstChild!; range.setStart(text, 1); range.setEnd(text, 4); }
        else if (kind === 'exact-label') { range.setStart(element.querySelector('strong')!.firstChild!, 0); range.setEnd(element.lastChild!, element.lastChild!.textContent!.length); }
        else range.selectNodeContents(element);
        const selection = getSelection()!; selection.removeAllRanges(); selection.addRange(range);
        const native = selection.toString();
        const data = new DataTransfer(); window.dispatchEvent(new ClipboardEvent('copy', { clipboardData: data, cancelable: true, bubbles: true }));
        return { native, text: data.getData('text/plain'), selectionAfter: selection.toString() };
      }, { selector, kind });
    }
    assert.equal((await copy('a')).text, '[Label text](https://example.com/path?a=1&b=2)');
    assert.equal((await copy('a', 'exact-label')).text, '[Label text](https://example.com/path?a=1&b=2)');
    assert.equal((await copy('a', 'partial')).text, 'abe');
    assert.equal((await copy('[data-image-alt="Example"]', 'node')).text, '![Example](tabletop://./picture)');
    assert.equal((await copy('[data-image-alt="Missing"]', 'node')).text, '![Missing](tabletop://./absent)');
    assert.equal((await copy('[data-image-alt="External"]', 'node')).text, '![External](https://example.com/image.png)');
    assert.equal((await copy('input:not(:checked)', 'node')).text, '[ ]');
    assert.equal((await copy('input:checked', 'node')).text, '[x]');
    const table = await copy('table'); assert.equal(table.text, table.native); assert.ok(!table.text.includes('|'));
    const bold = await copy('p > strong'); assert.equal(bold.text, 'bold');
    await page.keyboard.press('Control+a');
    const all = await page.evaluate(() => {
      const selection = getSelection()!; const before = selection.toString();
      const data = new DataTransfer(); window.dispatchEvent(new ClipboardEvent('copy', { clipboardData: data, cancelable: true, bubbles: true }));
      return { text: data.getData('text/plain'), before, after: selection.toString() };
    });
    assert.match(all.text, /\[Label text\]\(https:\/\/example.com\/path\?a=1&b=2\)/);
    assert.match(all.text, /\[ \] Pending/); assert.match(all.text, /\[x\] Done/);
    assert.match(all.text, /!\[Example\]\(tabletop:\/\/\.\/picture\)/);
    assert.ok(!all.text.includes('**bold**')); assert.ok(!all.text.includes('| Name |'));
    assert.equal(all.before, all.after);
    assert.equal((await call('desk_get', { id: 'memo' })).text, source);
    assert.equal((await call('desk_summary')).revision, revision);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
