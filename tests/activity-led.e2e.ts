import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTestDesk } from './desk-browser';

test('traffic LED has visible dark gaps, stable command colors and a bounded burst queue without document edits', { timeout: 30_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('activity-led');
  try {
    const before = await call('desk_state');
    const led = page.locator('#ai-activity-led');
    await page.waitForFunction(() => document.querySelector('#ai-activity-led')?.getAttribute('data-lit') === 'false');
    await call('desk_summary');
    await page.waitForFunction(() => document.querySelector('#ai-activity-led')?.getAttribute('data-lit') === 'true');
    const firstColor = await led.evaluate(el => (el as HTMLElement).style.getPropertyValue('--activity-color'));
    await page.waitForFunction(() => document.querySelector('#ai-activity-led')?.getAttribute('data-lit') === 'false');
    await call('desk_summary');
    await page.waitForFunction(() => document.querySelector('#ai-activity-led')?.getAttribute('data-lit') === 'true');
    assert.equal(await led.evaluate(el => (el as HTMLElement).style.getPropertyValue('--activity-color')), firstColor);
    await page.waitForFunction(() => document.querySelector('#ai-activity-led')?.getAttribute('data-lit') === 'false');
    // Wait for the final dark interval to drain using the browser clock, not OS input.
    await page.waitForTimeout(220);
    await page.evaluate(() => {
      const el = document.querySelector('#ai-activity-led')!;
      const events: { lit: string | null; at: number }[] = [];
      (window as any).ledEvents = events;
      let last = el.getAttribute('data-lit');
      new MutationObserver(() => {
        const lit = el.getAttribute('data-lit');
        if (lit !== last) { last = lit; events.push({ lit, at: performance.now() }); }
      }).observe(el, { attributes: true, attributeFilter: ['data-lit'] });
    });
    await Promise.all(Array.from({ length: 30 }, () => call('desk_summary')));
    await page.waitForTimeout(1700);
    const events = await page.evaluate(() => (window as any).ledEvents as { lit: string; at: number }[]);
    const lit = events.filter(event => event.lit === 'true');
    assert.ok(lit.length >= 2 && lit.length <= 5, `burst should drop queued pulses: ${lit.length}`);
    for (let i = 0; i < events.length - 1; i++) {
      assert.notEqual(events[i].lit, events[i + 1].lit);
      assert.ok(events[i + 1].at - events[i].at >= 120, 'both light and dark must be visible');
    }
    assert.equal(await led.getAttribute('data-lit'), 'false');
    assert.equal(await led.evaluate(el => getComputedStyle(el).pointerEvents), 'none');
    assert.deepEqual(await call('desk_state'), before);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('reduced motion coalesces traffic into one steady light until quiet', { timeout: 30_000 }, async () => {
  const { page, call, close, errors } = await openTestDesk('activity-led-reduced');
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await call('desk_summary');
    await page.waitForFunction(() => document.querySelector('#ai-activity-led')?.getAttribute('data-lit') === 'true');
    await page.waitForTimeout(350);
    assert.equal(await page.locator('#ai-activity-led').getAttribute('data-lit'), 'true');
    await page.waitForFunction(() => document.querySelector('#ai-activity-led')?.getAttribute('data-lit') === 'false');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
