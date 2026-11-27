import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openTestDesk } from './desk-browser';
import { callTestTool } from './mcp-call';

test('AI reads logical positions and selects native text, complete links, checkboxes and images without document or clipboard writes', { timeout: 40_000 }, async () => {
  const { page, client, call, close, errors } = await openTestDesk('ai-text-selection', `Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>{throw Error('No clipboard writes')},write:()=>{throw Error('No clipboard writes')}}});`);
  try {
    const source = '# Heading\n\nHello **世界** and [Link label](https://example.com/).\nNext line 😀 é 👨‍👩‍👧\n\n- [ ] Pending\n- [x] Done\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n![missing](tabletop://./absent)\n\n```text\nx  y\nz\n```';
    await call('desk_execute', { operations: [
      { kind: 'add', object: { id: 'memo', type: 'text', text: source, x: 100, y: 100, width: 600, height: 1000 } },
      { kind: 'add', object: { id: 'other', type: 'text', text: 'Other card', x: 800, y: 100 } },
    ] });
    const before = await call('desk_state'), camera = await call('desk_camera_get');
    const read = await call('desk_text_selection_read', { id: 'memo' });
    assert.equal(read.offsetUnit, 'utf16'); assert.equal(read.length, read.text.length);
    assert.equal(read.text, 'Heading\nHello 世界 and Link label.\nNext line 😀 é 👨‍👩‍👧\n[ ] Pending\n[x] Done\nA\tB\n1\t2\n\ufffc\nx  y\nz\n');
    assert.equal(read.atoms.length, 3);
    assert.equal(await page.locator('#canvas').getAttribute('data-text-selection'), null);
    async function select(start: number, end: number) { return call('desk_text_select', { action: 'range', id: 'memo', start, end, contentToken: read.contentToken }); }
    async function copy() {
      return page.evaluate(() => {
        const data = new DataTransfer(); window.dispatchEvent(new ClipboardEvent('copy', { clipboardData: data, bubbles: true, cancelable: true })); return data.getData('text/plain');
      });
    }
    const start = read.text.indexOf('世界'); await select(start, start + 2);
    assert.equal(await page.evaluate(() => getSelection()?.toString()), '世界');
    assert.equal(await copy(), '世界');
    const paragraph = (await page.locator('[data-id="memo"] p').first().boundingBox())!;
    await page.mouse.move(paragraph.x + 10, paragraph.y + 10); await page.mouse.down();
    assert.equal((await callTestTool(client, { name: 'desk_text_select', arguments: { action: 'clear' } })).isError, true);
    await page.mouse.up();
    const link = read.text.indexOf('Link label'); await select(link, link + 'Link label'.length);
    assert.equal(await copy(), '[Link label](https://example.com/)');
    await select(link + 1, link + 4); assert.equal(await copy(), 'ink');
    for (const atom of read.atoms) {
      await select(atom.start, atom.end);
      assert.equal(await copy(), atom.kind === 'image' ? '![missing](tabletop://./absent)' : read.text.slice(atom.start, atom.end));
    }
    await call('desk_text_select', { action: 'all', id: 'other' });
    assert.equal(await page.locator('#canvas').getAttribute('data-text-selection'), 'other');
    const preserved = await page.evaluate(() => getSelection()?.toString());
    for (const [start, end] of [[read.text.indexOf('😀') + 1, read.text.indexOf('😀') + 2], [read.text.indexOf('é'), read.text.indexOf('é') + 1], [read.atoms[0].start + 1, read.atoms[0].end], [0, read.length + 1]]) {
      const result = await callTestTool(client, { name: 'desk_text_select', arguments: { action: 'range', id: 'memo', start, end, contentToken: read.contentToken } });
      assert.equal(result.isError, true, JSON.stringify(result));
      assert.equal(await page.evaluate(() => getSelection()?.toString()), preserved);
      assert.equal(await page.locator('#canvas').getAttribute('data-text-selection'), 'other');
    }
    await call('desk_text_select', { action: 'mode', id: 'memo' });
    assert.equal(await page.evaluate(() => getSelection()?.toString()), '');
    await call('desk_text_select', { action: 'all', id: 'memo' });
    assert.ok((await copy()).includes('[x] Done'));
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#canvas').getAttribute('data-text-selection'), null);
    await call('desk_text_select', { action: 'all', id: 'other' }); await call('desk_text_select', { action: 'clear' });
    assert.equal(await page.locator('#canvas').getAttribute('data-text-selection'), null);
    assert.equal((await call('desk_summary')).revision, before.revision);
    assert.deepEqual((await call('desk_state')).objects, before.objects);
    assert.deepEqual(await call('desk_camera_get'), camera);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('AI range tokens survive unrelated edits but reject changed text and identical reloaded documents; UI guards prevent interruption', { timeout: 40_000 }, async () => {
  const { page, client, call, close, errors } = await openTestDesk('ai-text-selection-stale');
  const directory = await mkdtemp(join(tmpdir(), 'tabletop-text-selection-'));
  try {
    await call('desk_execute', { operations: [
      { kind: 'add', object: { id: 'memo', type: 'text', text: 'Original text', x: 100, y: 100, width: 600, height: 400 } },
      { kind: 'add', object: { id: 'other', type: 'text', text: 'Other', x: 800, y: 100 } },
    ] });
    const read = await call('desk_text_selection_read', { id: 'memo' });
    await call('desk_execute', { operations: [{ kind: 'update', id: 'other', patch: { text: 'Other changed' } }] });
    await call('desk_text_select', { action: 'range', id: 'memo', start: 0, end: 8, contentToken: read.contentToken });
    assert.equal(await page.evaluate(() => getSelection()?.toString()), 'Original');
    await call('desk_execute', { operations: [{ kind: 'update', id: 'memo', patch: { text: 'Changed text' } }] });
    await call('desk_text_select', { action: 'all', id: 'other' });
    const stale = await callTestTool(client, { name: 'desk_text_select', arguments: { action: 'range', id: 'memo', start: 0, end: 8, contentToken: read.contentToken } });
    assert.equal(stale.isError, true); assert.equal(await page.evaluate(() => getSelection()?.toString()), 'Other changed');
    const fresh = await call('desk_text_selection_read', { id: 'memo' });
    const saved = await call('desk_save', { path: join(directory, 'desk.tabletop') });
    const summary = await call('desk_summary');
    await call('desk_load', { path: saved.path, confirm: true, expectedSessionId: summary.sessionId, expectedRevision: summary.revision });
    assert.equal((await callTestTool(client, { name: 'desk_text_select', arguments: { action: 'range', id: 'memo', start: 0, end: 7, contentToken: fresh.contentToken } })).isError, true);
    await page.locator('#thinking-mode').click();
    assert.equal((await call('desk_text_selection_read', { id: 'memo' })).text, 'Changed text');
    assert.equal((await callTestTool(client, { name: 'desk_text_select', arguments: { action: 'all', id: 'memo' } })).isError, true);
    await page.locator('#thinking-mode').click();
    await page.locator('[data-id="memo"] .markdown-text').dblclick();
    assert.equal((await callTestTool(client, { name: 'desk_text_select', arguments: { action: 'all', id: 'memo' } })).isError, true);
    assert.equal(await page.locator('#canvas').getAttribute('data-text-selection'), null);
    await page.locator('[data-inline-text]').press('Escape');
    await call('desk_text_select', { action: 'all', id: 'memo' });
    await page.keyboard.press('Control+c');
    await call('desk_text_select', { action: 'clear' });
    assert.deepEqual(errors, []);
  } finally { await close(); await rm(directory, { recursive: true, force: true }); }
});
