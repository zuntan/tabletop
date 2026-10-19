import { test } from 'node:test';
import assert from 'node:assert/strict';
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
    assert.equal(await memo.locator('.markdown-text').evaluate(element => getComputedStyle(element).overflow), 'hidden');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
