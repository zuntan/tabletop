import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDesk } from './desk-browser';

test('selected frames create bound connectors and Markdown frames accept endpoint snapping', { timeout: 45_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('selection-connections');
  try {
    await call('desk_execute', { operations: [
      { kind: 'add', object: { id: 'memo', type: 'text', x: 220, y: 150, width: 220, height: 160, text: '## Memo' } },
      { kind: 'add', object: { id: 'shape', type: 'rect', x: 650, y: 180 } },
      { kind: 'label_add', id: 'pin', seriesId: 'series-1', x: 650, y: 400 },
    ] });
    await call('desk_select', { ids: ['memo', 'shape'] }); await page.locator('[data-add="arrow"]').click();
    const edgeId = (await call('desk_selection')).ids[0];
    const edge = await call('desk_get', { id: edgeId });
    assert.deepEqual(edge.startBinding, { objectId: 'memo', anchor: 'right' });
    assert.deepEqual(edge.endBinding, { objectId: 'shape', anchor: 'left' });
    await call('desk_execute', { operations: [{ kind: 'update', id: 'memo', patch: { x: 244 } }] });
    assert.equal((await call('desk_get', { id: edgeId })).x, 464);
    await call('desk_select', { ids: ['memo'] }); await page.locator('[data-add="line"]').click();
    const singleId = (await call('desk_selection')).ids[0];
    assert.equal((await call('desk_get', { id: singleId })).startBinding.objectId, 'memo');
    assert.equal((await call('desk_get', { id: singleId })).endBinding, null);
    await call('desk_select', { ids: [] }); await page.locator('[data-add="arrow"]').click();
    const freeId = (await call('desk_selection')).ids[0];
    assert.ok(!(await call('desk_get', { id: freeId })).startBinding);
    const handle = (await page.locator(`[data-connector="${freeId}"][data-endpoint="end"]`).boundingBox())!;
    const target = await page.locator('#viewport').evaluate(element => {
      const matrix = (element as unknown as SVGGElement).getScreenCTM()!;
      const point = new DOMPoint(354, 150).matrixTransform(matrix); return { x: point.x, y: point.y };
    });
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 5 }); await page.mouse.up();
    assert.deepEqual((await call('desk_get', { id: freeId })).endBinding, { objectId: 'memo', anchor: 'top' });
    await call('desk_select', { ids: ['shape', 'pin'] }); await page.locator('[data-add="line"]').click();
    const vertical = await call('desk_get', { id: (await call('desk_selection')).ids[0] });
    assert.equal(vertical.startBinding.anchor, 'bottom'); assert.equal(vertical.endBinding.anchor, 'top');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('fill transparency controls affect only fills and editor key preference supports multiline input', { timeout: 45_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('opacity-editor');
  try {
    await call('desk_execute', { operations: [{ kind: 'add', object: { id: 'memo', type: 'text', x: 250, y: 150, width: 360, height: 260, text: '## Memo', fill: '#fef9c3' } }] });
    const memo = page.locator('[data-id="memo"]');
    assert.equal(await memo.locator(':scope > rect').getAttribute('fill-opacity'), '0.3');
    assert.equal(await memo.locator('.markdown-text').evaluate(element => getComputedStyle(element).opacity), '1');
    await call('desk_select', { ids: ['memo'] });
    const opacity = page.locator('#default-opacity'); await opacity.fill('35'); await opacity.press('Tab');
    assert.equal((await call('desk_get', { id: 'memo' })).fillOpacity, 0.65);
    assert.equal((await call('desk_settings')).defaults.fillOpacity, 0.65);
    await page.locator('#undo').click(); assert.equal((await call('desk_get', { id: 'memo' })).fillOpacity, 0.3);
    await page.locator('#properties [name="fillOpacity"]').fill('20');
    await page.locator('#properties button[type="submit"]').click();
    assert.equal((await call('desk_get', { id: 'memo' })).fillOpacity, 0.8);
    await call('desk_execute', { operations: [{ kind: 'update', id: 'memo', patch: { fillOpacity: 0.333 } }] });
    await page.locator('#properties [name="x"]').fill('260'); await page.locator('#properties button[type="submit"]').click();
    assert.equal((await call('desk_get', { id: 'memo' })).fillOpacity, 0.333);
    await memo.locator('h2').dblclick();
    const input = page.locator('[data-inline-text]'); const mode = page.getByRole('combobox', { name: '確定キー' });
    await mode.selectOption('mod-enter'); await input.fill('One'); await input.press('Enter'); await page.keyboard.type('Two');
    assert.equal(await input.inputValue(), 'One\nTwo'); assert.equal(await page.locator('.inline-editor').count(), 1);
    await input.press('Control+Enter'); assert.equal((await call('desk_get', { id: 'memo' })).text, 'One\nTwo');
    await memo.locator('.markdown-text').dblclick(); assert.equal(await mode.inputValue(), 'mod-enter');
    await input.dispatchEvent('compositionstart');
    await input.dispatchEvent('keydown', { key: 'Enter', ctrlKey: true, isComposing: true });
    assert.equal(await page.locator('.inline-editor').count(), 1);
    await input.dispatchEvent('compositionend'); await input.fill('Button confirmed');
    await page.locator('.inline-editor').getByRole('button', { name: '確定', exact: true }).click();
    assert.equal((await call('desk_get', { id: 'memo' })).text, 'Button confirmed');
    await memo.locator('.markdown-text').dblclick(); await mode.selectOption('enter');
    await input.fill('Legacy'); await input.press('Enter'); assert.equal((await call('desk_get', { id: 'memo' })).text, 'Legacy');
    assert.equal(await page.evaluate(() => localStorage.getItem('tabletop.editor.submit-key')), 'enter');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
