import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openTestDesk } from './desk-browser';

test('Markdown memo keeps source editing, independent colors and safe links without disrupting gestures', { timeout: 45_000 }, async () => {
  const { page, call, close, port, errors } = await openTestDesk('markdown-test');
  try {
    await page.locator('#grid-snap').click(); // Markdown gesture behavior is independent of grid placement.
    const destination = `http://127.0.0.1:${port}/missing`;
    const source = `# Memo\n\n**strong**\nsecond line\n\n- item\n\n[open](${destination})`;
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'memo', type: 'text', x: 250, y: 150, width: 400, height: 320, text: source, fill: 'transparent', stroke: 'transparent' } }] });
    const memo = page.locator('[data-id="memo"]');
    assert.equal(await memo.locator('h1').innerText(), 'Memo');
    assert.equal(await memo.locator('strong').innerText(), 'strong');
    assert.equal(await memo.locator('a').evaluate(element => getComputedStyle(element).fontSize), '24px');
    assert.equal(await memo.locator(':scope > rect').getAttribute('fill'), 'transparent');
    assert.equal(await memo.locator(':scope > rect').getAttribute('stroke'), 'transparent');
    await memo.locator('h1').dblclick();
    assert.equal(await page.locator('[data-inline-text]').inputValue(), source);
    await page.locator('[data-inline-text]').fill(source + '\n\n> Quote');
    await page.locator('[data-inline-text]').press('Enter');
    assert.equal(await memo.locator('blockquote').innerText(), 'Quote');
    await call('desk_execute', { operations: [{ kind: 'update', id: 'memo', patch: { fill: '#fef9c3', stroke: '#334155', textColor: '#7f1d1d' } }] });
    assert.equal(await memo.locator(':scope > rect').getAttribute('fill'), '#fef9c3');
    assert.equal(await memo.locator('.markdown-text').evaluate(element => getComputedStyle(element).color), 'rgb(127, 29, 29)');
    assert.equal(await memo.locator('.markdown-text').evaluate(element => getComputedStyle(element).padding), '6px');
    // Measure the layout box; a stroked SVG rect's bounds also include its outline.
    const frame = (await memo.locator('foreignObject').boundingBox())!;
    const quote = (await memo.locator('blockquote').boundingBox())!;
    assert.equal(quote.x - frame.x, 6);
    assert.equal(frame.width - quote.width, 12);
    assert.equal((await call('desk_get', { id: 'memo' })).text, source + '\n\n> Quote');
    await page.locator('#numbering').click();
    const state = await call('desk_state');
    const [popup] = await Promise.all([page.waitForEvent('popup'), memo.locator('a').click()]);
    await popup.waitForURL(destination); assert.equal(await popup.evaluate(() => window.opener === null), true); await popup.close();
    assert.deepEqual(await call('desk_state'), state);
    await page.locator('#selection-mode').click();
    const box = (await memo.locator('h1').boundingBox())!;
    await page.mouse.move(box.x + 30, box.y + 20); await page.mouse.down();
    await page.mouse.move(box.x + 78, box.y + 44, { steps: 4 }); await page.mouse.up();
    assert.equal((await call('desk_get', { id: 'memo' })).x, 298);
    await call('desk_execute', { operations: [{ kind: 'update', id: 'memo', patch: { text: '<script>alert(1)</script>\n\n![image](https://example.com/a.png)' } }] });
    assert.equal(await memo.locator('script,img').count(), 0);
    await call('desk_execute', { operations: [{ kind: 'update', id: 'memo', patch: { text: '| 項目 | 数量 |\n| --- | ---: |\n| 長い日本語の説明文 | 123 |\n\n- [ ] 未完了\n- [x] 完了\n\nhttps://example.com/' } }] });
    assert.equal(await memo.locator('table').count(), 1);
    assert.equal(await memo.locator('td').last().evaluate(element => getComputedStyle(element).textAlign), 'right');
    assert.equal(await memo.locator('th').first().evaluate(element => getComputedStyle(element).borderTopStyle), 'solid');
    assert.equal(await memo.locator('input:enabled').count(), 2);
    assert.equal(await memo.locator('input:checked').count(), 1);
    const checkboxStyle = await memo.locator('input:checked').evaluate(element => {
      const box = getComputedStyle(element), tick = getComputedStyle(element, '::after');
      return { appearance: box.appearance, opacity: box.opacity, color: box.color, tickColor: tick.borderRightColor };
    });
    assert.deepEqual(checkboxStyle, { appearance: 'none', opacity: '1', color: 'rgb(127, 29, 29)', tickColor: 'rgb(127, 29, 29)' });
    assert.equal(await memo.locator('a').getAttribute('href'), 'https://example.com/');
    const beforeToggle = await call('desk_get', { id: 'memo' });
    const beforeSelection = await call('desk_selection');
    await memo.locator('input').first().click();
    const afterToggle = await call('desk_get', { id: 'memo' });
    assert.equal(afterToggle.text, beforeToggle.text.replace('- [ ] 未完了', '- [x] 未完了'));
    assert.equal(afterToggle.x, beforeToggle.x);
    assert.deepEqual((await call('desk_selection')).ids, beforeSelection.ids);
    const directory = await mkdtemp(join(tmpdir(), 'tabletop-task-'));
    try {
      const saved = await call('desk_save', { path: join(directory, 'tasks.tabletop') });
      const exported = await call('desk_pdf', { path: join(directory, 'tasks.pdf') });
      assert.ok(exported.bytes > 0);
      await call('desk_execute', { operations: [{ kind: 'update', id: 'memo', patch: { text: 'temporary' } }] });
      const summary = await call('desk_summary');
      await call('desk_load', { path: saved.path, confirm: true, expectedRevision: summary.revision, expectedSessionId: summary.sessionId });
      assert.equal((await call('desk_get', { id: 'memo' })).text, afterToggle.text);
    } finally { await rm(directory, { recursive: true, force: true }); }
    await call('desk_undo');
    await call('desk_undo');
    await call('desk_undo');
    assert.equal((await call('desk_get', { id: 'memo' })).text, beforeToggle.text);
    assert.equal(await memo.locator('.markdown-text').evaluate(element => getComputedStyle(element).overflow), 'hidden');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
