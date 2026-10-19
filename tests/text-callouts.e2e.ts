import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';

test('text callout palette enables one outline, tip drag binds and Alt detaches, resize/save/Undo preserve text', { timeout: 30_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('text-callouts');
  page.setDefaultTimeout(5000);
  try {
    await call('desk_execute', { operations: [
      { kind: 'grid_update', patch: { enabled: false } },
      { kind: 'add', object: { id: 'note', type: 'text', x: 100, y: 100, width: 200, height: 120, text: '**ひとこと**', fill: '#ffffff', fillOpacity: .5 } },
      { kind: 'add', object: { id: 'target', type: 'rect', x: 500, y: 250, width: 150, height: 150 } },
    ] });
    await call('desk_select', { ids: ['note'] });
    await page.getByRole('button', { name: '吹き出しの候補', exact: true }).click();
    await page.getByRole('dialog', { name: '吹き出しの候補', exact: true }).getByRole('button', { name: '三角', exact: true }).click();
    assert.equal(await page.locator('[data-id=note] > rect').count(), 0);
    assert.equal(await page.locator('[data-id=note] > path.text-callout').count(), 1);
    assert.equal(await page.locator('[data-id=note] .markdown-text strong').innerText(), 'ひとこと');
    assert.ok(await page.locator('.text-callout').evaluate(el => (el as SVGPathElement).getTotalLength() > 0));
    async function dragTip(x: number, y: number, alt = false) {
      const box = (await page.locator('[data-callout-tip=note]').boundingBox())!;
      const target = await page.locator('#viewport').evaluate((el, p) => {
        const point = new DOMPoint(p.x, p.y).matrixTransform((el as unknown as SVGGraphicsElement).getScreenCTM()!);
        return { x: point.x, y: point.y };
      }, { x, y });
      if (alt) await page.keyboard.down('Alt');
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
      await page.mouse.move(target.x, target.y, { steps: 8 }); await page.mouse.up();
      if (alt) await page.keyboard.up('Alt');
    }
    await dragTip(500, 325);
    assert.deepEqual((await call('desk_get', { id: 'note' })).callout.binding, { objectId: 'target', anchor: 'left' });
    const originalText = (await call('desk_get', { id: 'note' })).text;
    await call('desk_execute', { operations: [{ kind: 'update', id: 'target', patch: { height: 200 } }] });
    assert.equal((await call('desk_get', { id: 'note' })).callout.y, 350);
    assert.equal((await call('desk_get', { id: 'note' })).x, 100);
    const before = (await call('desk_state')).objects;
    await dragTip(400, 450, true);
    assert.equal((await call('desk_get', { id: 'note' })).callout.binding, null);
    await call('desk_undo'); assert.deepEqual((await call('desk_state')).objects, before);
    await page.getByRole('button', { name: '吹き出しの候補', exact: true }).click();
    await page.getByRole('dialog', { name: '吹き出しの候補', exact: true }).getByRole('button', { name: '考え事', exact: true }).click();
    const thought = await call('desk_get', { id: 'note' });
    assert.equal(thought.callout.style, 'thought');
    assert.deepEqual(thought.callout.binding, { objectId: 'target', anchor: 'left' });
    assert.equal((await page.locator('.text-callout').getAttribute('d'))!.match(/ a/g)!.length, 6);
    await page.getByRole('button', { name: '吹き出しの候補', exact: true }).click();
    await page.getByRole('dialog', { name: '吹き出しの候補', exact: true }).getByRole('button', { name: '引き出し線', exact: true }).click();
    const leader = await call('desk_get', { id: 'note' });
    assert.equal(leader.callout.style, 'leader');
    assert.deepEqual(leader.callout.binding, thought.callout.binding);
    assert.equal(await page.locator('[data-id=note] .callout-leader').count(), 1);
    assert.equal(await page.locator('[data-id=note] .callout-leader-dot').count(), 1);
    assert.equal((await page.locator('[data-id=note] .callout-leader').getAttribute('d'))!.split(' L').length, 3);
    const thoughtBefore = (await call('desk_state')).objects;
    const saved = await call('desk_save', { filename: 'callout-' + Date.now() + '.tabletop' });
    await page.getByRole('button', { name: '吹き出しの候補', exact: true }).click();
    await page.getByRole('dialog', { name: '吹き出しの候補', exact: true }).getByRole('button', { name: 'なし', exact: true }).click();
    assert.equal(await page.locator('.text-callout').count(), 0);
    assert.equal((await call('desk_get', { id: 'note' })).text, originalText);
    const current = await call('desk_summary');
    await call('desk_load', { filename: saved.filename, confirm: true, expectedSessionId: current.sessionId, expectedRevision: current.revision });
    assert.deepEqual((await call('desk_state')).objects, thoughtBefore);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
