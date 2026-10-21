import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDesk } from './desk-browser';

test('explicit format slots synchronize current controls, preserve snapshots and style text paste without overriding object copies', { timeout: 60000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('format-style');
  try {
    await call('desk_execute', { operations: [
      { kind: 'add', object: { id: 'sample', type: 'text', text: 'sample', x: 20, y: 20, fill: '#fff7ed', stroke: '#cc1122', fontSize: 48, padding: 30, cornerRadius: 40 } },
      { kind: 'add', object: { id: 'target', type: 'text', text: 'target', x: 500, y: 20, fontSize: 18 } },
      { kind: 'add', object: { id: 'line', type: 'line', x: 10, y: 400, x2: 400, y2: 400, stroke: '#00aa00', strokeWidth: 16, dash: 'dashed', endMarker: 'diamond', junctionRounding: 192 } },
    ] });
    const initial = (await call('desk_settings')).defaults;
    await call('desk_select', { ids: ['sample'] });
    assert.deepEqual((await call('desk_settings')).defaults, initial);
    await page.locator('#format-capture-0').click();
    assert.equal(await page.locator('#format-palette').isVisible(), false);
    await call('desk_select', { ids: ['target'] }); await page.locator('#format-apply-0').click();
    assert.equal((await call('desk_get', { id: 'target' })).padding, 30);
    await call('desk_select', { ids: ['sample'] });
    await page.locator('#format-open').click(); await page.locator('#format-capture-1').click();
    assert.equal((await call('desk_settings')).defaults.fontSize, 48);
    await call('desk_select', { ids: ['target'] }); await page.locator('#format-apply-1').click();
    let target = await call('desk_get', { id: 'target' }); assert.equal(target.fontSize, 48); assert.equal(target.padding, 30); assert.equal(target.text, 'target'); assert.equal(target.x, 500);
    await page.locator('#format-open').click();
    await page.locator('#default-width').fill('8'); await page.locator('#default-width').press('Enter');
    const memory = await page.evaluate(() => JSON.parse(localStorage.getItem('tabletop.format-styles.v1')!));
    assert.equal(memory.current.strokeWidth, 8); assert.equal(memory.slots[0].strokeWidth, 2);
    await page.evaluate(() => document.querySelector('#canvas')!.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, clipboardData: (() => { const data = new DataTransfer(); data.setData('text/plain', 'pasted text'); return data; })() })));
    let pasted = (await call('desk_list')).objects.find((o: any) => o.text === 'pasted text');
    assert.equal(pasted.fontSize, 48); assert.equal(pasted.padding, 30); assert.equal(pasted.strokeWidth, 8);
    // Same-tab object copy retains the source rather than adopting another current style.
    await call('desk_select', { ids: ['target'] });
    await page.evaluate(() => { const data = new DataTransfer(); document.querySelector('#canvas')!.dispatchEvent(new ClipboardEvent('copy', { bubbles: true, clipboardData: data })); (window as any).__formatCopy = data; });
    // Exercise line-specific snapshot and creation without leaking text attributes into its patch.
    await call('desk_select', { ids: ['line'] }); await page.locator('#format-open').click(); await page.locator('#format-capture-2').click(); await page.locator('#format-open').click();
    await page.evaluate(() => document.querySelector('#canvas')!.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, clipboardData: (window as any).__formatCopy })));
    const copied = (await call('desk_list')).objects.filter((o: any) => o.text === 'target' && o.id !== 'target')[0];
    assert.equal(copied.fontSize, 48); assert.equal(copied.strokeWidth, 8); assert.equal(copied.stroke, '#cc1122');
    await page.getByRole('button', { name: '線', exact: true }).click();
    const line = (await call('desk_list')).objects.at(-1); assert.equal(line.dash, 'dashed'); assert.equal(line.endMarker, 'diamond'); assert.equal(line.junctionRounding, 192);
    await page.locator('#format-open').click(); await page.locator('#format-apply-1').click();
    assert.equal(await page.locator('#default-width').inputValue(), '2');
    await page.reload(); await page.waitForSelector('#format-open');
    await page.locator('#format-open').click(); assert.equal(await page.locator('#format-apply-1').isDisabled(), true); assert.equal(await page.locator('#format-apply-2').isDisabled(), true); // no selected object after reload
    const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('tabletop.format-styles.v1')!)); assert.equal(restored.slots[1].dash, 'dashed'); assert.equal(restored.current.padding, 30);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
