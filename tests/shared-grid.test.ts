import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { Desk, dispatch, type Batch } from '../src/model.js';
import { gridPoint, gridOrigin } from '../src/grid.js';
import { gridSettingsSchema } from '../src/grid-settings.js';
import { gestureOperations, type Gesture } from '../src/diagram-gestures.js';
import { encodeDeskFile, decodeDeskFile } from '../src/desk-file.js';

function apply(desk: Desk, operations: Batch['operations'], options: Omit<Batch, 'operations'> = {}) {
  return dispatch(desk, { method: 'execute', operations, ...options }) as ReturnType<Desk['execute']>;
}

test('shared grid defaults ON; settings/context expose isolated world interval and origin', () => {
  const desk = new Desk(), grid = { enabled: true, interval: 24, origin: { x: 0, y: 0 } };
  assert.deepEqual(desk.settingsSnapshot().grid, grid);
  const settings = dispatch(desk, { method: 'settings' }) as ReturnType<Desk['listSettings']>;
  const context = dispatch(desk, { method: 'context' }) as { settings: typeof settings };
  assert.deepEqual(settings.grid, grid); assert.deepEqual(context.settings.grid, grid);
  settings.grid.origin.x = 99; context.settings.grid.enabled = false;
  assert.deepEqual(desk.settingsSnapshot().grid, grid); assert.equal(desk.revision, 0);
  assert.deepEqual(gridPoint({ x: -13, y: 18 }, { enabled: true, interval: 10, origin: { x: 3, y: -4 } }), { x: -17, y: 16 });
});

test('MCP follows the grid by default, exact bypass does not touch it, and applied geometry is returned even on no-op', () => {
  const desk = new Desk();
  const result = apply(desk, [{ kind: 'add', object: { id: 'r', type: 'rect', x: 35, y: -35 } }]);
  assert.equal(result.placement.mode, 'desk'); assert.equal(desk.get('r').x, 24); assert.equal(desk.get('r').y, -24);
  assert.equal(result.placement.results[0].requested.x, 35);
  assert.equal(result.placement.results[0].applied?.x, 24); assert.equal(result.placement.results[0].snapped, true);
  const revision = desk.revision;
  const noop = apply(desk, [{ kind: 'update', id: 'r', patch: { x: 35 } }]);
  assert.equal(desk.revision, revision); assert.equal(noop.placement.results[0].snapped, true);
  const exact = apply(desk, [{ kind: 'update', id: 'r', patch: { x: 35 } }], { snap: 'exact' });
  assert.equal(desk.get('r').x, 35); assert.equal(desk.get('r').y, -24);
  assert.equal(exact.placement.results[0].snapped, false); assert.equal(desk.settingsSnapshot().grid.enabled, true);
  apply(desk, [{ kind: 'grid_update', patch: { enabled: false } }]);
  apply(desk, [{ kind: 'update', id: 'r', patch: { x: 37 } }]); assert.equal(desk.get('r').x, 37);
});

test('grid changes share revision/Undo, never reposition existing objects, and failed batches roll back everything', () => {
  const desk = new Desk();
  desk.execute({ operations: [{ kind: 'add', object: { id: 'r', type: 'rect', x: 13, y: 17 } }] });
  const before = desk.snapshot(), settings = desk.settingsSnapshot();
  apply(desk, [{ kind: 'grid_update', patch: { enabled: false, interval: 10, origin: { x: 3, y: -4 } } }]);
  assert.deepEqual(desk.snapshot(), before); assert.equal(desk.revision, 2);
  assert.deepEqual(desk.getChanges(1).changes[0].targets, ['grid']);
  desk.undo(); assert.deepEqual(desk.settingsSnapshot(), settings);
  desk.redo(); assert.equal(desk.settingsSnapshot().grid.interval, 10);
  const revision = desk.revision, saved = desk.settingsSnapshot();
  assert.throws(() => apply(desk, [{ kind: 'grid_update', patch: { interval: 7 } }, { kind: 'delete', id: 'missing' }]));
  assert.deepEqual(desk.settingsSnapshot(), saved); assert.equal(desk.revision, revision);
  for (const interval of [0, -1, NaN, Infinity, 100_001]) {
    assert.throws(() => apply(desk, [{ kind: 'grid_update', patch: { interval } }]));
    assert.equal(desk.revision, revision);
  }
});

test('all label shapes snap their bottom-center; descriptions and shared style edits do not reposition pins', () => {
  for (const shape of ['pin', 'text', 'rect', 'roundedRect', 'ellipse'] as const) {
    const desk = new Desk();
    const result = apply(desk, [{ kind: 'series_update', id: 'series-1', patch: { shape, width: 36, height: 48 } },
      { kind: 'label_add', id: 'p', seriesId: 'series-1', x: 17, y: 9, description: '説明' }]);
    assert.deepEqual(gridOrigin(desk.get('p')), { x: 24, y: 48 });
    assert.equal(result.placement.results[0].requested.x, 17);
    assert.equal(result.placement.results[0].applied?.x, 6);
    const before = { x: desk.get('p').x, y: desk.get('p').y };
    const change = apply(desk, [{ kind: 'update', id: 'p', patch: { description: '長い説明文' } },
      { kind: 'series_update', id: 'series-1', patch: { width: 41 } }]);
    assert.deepEqual({ x: desk.get('p').x, y: desk.get('p').y }, before);
    assert.equal(change.placement.results.length, 0);
  }
});

test('UI and MCP moves share custom grid math and preserve relative positions with a chosen anchor', () => {
  const desk = new Desk();
  desk.execute({ operations: [{ kind: 'grid_update', patch: { interval: 10, origin: { x: 3, y: -4 } } },
    { kind: 'add', object: { id: 'r', type: 'rect', x: 13, y: 17 } },
    { kind: 'label_add', id: 'p', seriesId: 'series-1', x: 100, y: 110 }] });
  const originals = desk.snapshot(), grid = desk.settingsSnapshot().grid;
  const gesture: Gesture = { mode: 'move', start: { x: 0, y: 0 }, screen: { x: 0, y: 0 }, camera: { x: 0, y: 0 },
    originals, scene: originals, preview: originals, revision: desk.revision, additive: [], grid: true, gridSettings: grid, anchorId: 'p' };
  const expected = gestureOperations(gesture, { x: 21, y: 21 }, 0.5);
  const result = apply(desk, originals.map(object => ({ kind: 'update', id: object.id, patch: { x: object.x + 21, y: object.y + 21 } })), { snapAnchorId: 'p' });
  for (const operation of expected) if (operation.kind === 'update') {
    assert.equal(desk.get(operation.id).x, operation.patch.x); assert.equal(desk.get(operation.id).y, operation.patch.y);
  }
  assert.equal(desk.get('p').x - desk.get('r').x, 87); assert.equal(desk.get('p').y - desk.get('r').y, 93);
  assert.equal(result.placement.results.length, 2);
  assert.throws(() => apply(desk, [{ kind: 'update', id: 'r', patch: { x: 5 } }], { snapAnchorId: 'missing' }));
});

test('resize only snaps requested corners; single-axis edits leave other coordinates unchanged', () => {
  const desk = new Desk(); desk.execute({ operations: [{ kind: 'add', object: { id: 'r', type: 'rect', x: 13, y: 17, width: 48, height: 48 } }] });
  apply(desk, [{ kind: 'update', id: 'r', patch: { width: 58, height: 58 } }]);
  assert.equal(desk.get('r').width, 59); assert.equal(desk.get('r').height, 55);
  assert.equal(desk.get('r').x, 13); assert.equal(desk.get('r').y, 17);
  apply(desk, [{ kind: 'update', id: 'r', patch: { x: 35 } }]);
  assert.equal(desk.get('r').x, 24); assert.equal(desk.get('r').y, 17);
});

test('free endpoints snap, explicit and forward bindings override the grid, exact keeps sub-grid coordinates', () => {
  const desk = new Desk();
  const result = apply(desk, [{ kind: 'add', object: { id: 'a', type: 'arrow', x: 35, y: 35, x2: 100, y2: 101,
    endBinding: { objectId: 'r', anchor: 'left' } } },
    { kind: 'add', object: { id: 'r', type: 'rect', x: 47, y: 47, width: 90, height: 50 } }]);
  assert.equal(desk.get('a').x, 24); assert.equal(desk.get('a').y, 24);
  assert.equal(desk.get('a').x2, 48); assert.equal(desk.get('a').y2, 73);
  assert.equal(result.placement.results[0].applied?.y2, 73);
  apply(desk, [{ kind: 'update', id: 'a', patch: { x2: 151, y2: 152, endBinding: null } }]);
  assert.equal(desk.get('a').x2, 144); assert.equal(desk.get('a').y2, 144);
  apply(desk, [{ kind: 'update', id: 'a', patch: { x2: 151, y2: 152 } }], { snap: 'exact' });
  assert.equal(desk.get('a').x2, 151); assert.equal(desk.get('a').y2, 152);
  const before = desk.snapshot(), revision = desk.revision;
  assert.throws(() => apply(desk, [{ kind: 'add', object: { id: 'bad', type: 'line', x2: 9 } }]));
  assert.deepEqual(desk.snapshot(), before); assert.equal(desk.revision, revision);
});

test('placement reports final deletion without throwing after the commit', () => {
  const desk = new Desk();
  const result = apply(desk, [{ kind: 'add', object: { id: 'r', type: 'rect', x: 35 } }, { kind: 'delete', id: 'r' }]);
  assert.equal(result.placement.results[0].applied, null); assert.equal(desk.summary().count, 0);
});

test('grid round-trips in desk files; legacy files default ON/24/origin0 without changing any object', async () => {
  const desk = new Desk();
  desk.execute({ operations: [{ kind: 'grid_update', patch: { enabled: false, interval: 10, origin: { x: 3, y: -4 } } },
    { kind: 'add', object: { id: 'r', type: 'rect', x: 13, y: 17 } }] });
  const bytes = await encodeDeskFile(desk), document = await decodeDeskFile(bytes);
  assert.deepEqual(document.settings.grid, desk.settingsSnapshot().grid);
  const reopened = new Desk(); reopened.replaceDocument({ objects: document.objects, settings: document.settings });
  assert.deepEqual(reopened.settingsSnapshot().grid, desk.settingsSnapshot().grid);
  assert.deepEqual(reopened.snapshot(), desk.snapshot());
  const files = unzipSync(bytes), manifest = JSON.parse(strFromU8(files['manifest.json']));
  delete manifest.settings.grid; files['manifest.json'] = strToU8(JSON.stringify(manifest));
  const legacy = await decodeDeskFile(zipSync(files));
  assert.deepEqual(legacy.settings.grid, gridSettingsSchema.parse({})); assert.deepEqual(legacy.objects, desk.snapshot());
  const revision = reopened.revision;
  assert.throws(() => reopened.replaceDocument({ objects: document.objects, settings: { ...document.settings, grid: { interval: 0 } } }));
  assert.equal(reopened.revision, revision); assert.deepEqual(reopened.snapshot(), desk.snapshot());
});
