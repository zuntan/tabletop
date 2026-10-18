import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Desk, dispatch } from '../src/model';
import { encodeDeskFile, decodeDeskFile } from '../src/desk-file';

test('wallpaper changes are atomic settings edits, preserve parts and grid, and share undo', () => {
  const desk = new Desk();
  assert.deepEqual(desk.settingsSnapshot().background, { wallpaper: 'none', color: null, showGrid: null });
  desk.execute({ operations: [{ kind: 'add', object: { id: 'note', type: 'text', text: '机の文章', fill: '#fb7185' } }] });
  desk.select(['note']); const objects = desk.snapshot(), settings = desk.settingsSnapshot();
  dispatch(desk, { method: 'execute', operations: [{ kind: 'background_update', patch: { wallpaper: 'wood' } }] });
  assert.deepEqual(desk.snapshot(), objects); assert.deepEqual(desk.selected(), ['note']);
  assert.deepEqual(desk.settingsSnapshot().grid, settings.grid); assert.deepEqual(desk.settingsSnapshot().defaults, settings.defaults);
  assert.deepEqual(desk.getChanges(1).changes[0].targets, ['background']);
  desk.undo(); assert.deepEqual(desk.settingsSnapshot(), settings);
  desk.redo(); assert.equal(desk.settingsSnapshot().background.wallpaper, 'wood');
  const revision = desk.revision;
  assert.throws(() => desk.execute({ operations: [{ kind: 'background_update', patch: { wallpaper: 'pink-notebook' } }, { kind: 'delete', id: 'missing' }] }));
  assert.equal(desk.revision, revision); assert.equal(desk.settingsSnapshot().background.wallpaper, 'wood');
  assert.throws(() => desk.execute({ operations: [{ kind: 'background_update', patch: { wallpaper: 'unknown' } }] } as any));
});

test('wallpaper presets and overrides round-trip; older files get the unchanged plain desk', async () => {
  for (const wallpaper of ['wood', 'cutting-mat', 'pink-notebook'] as const) {
    const desk = new Desk();
    desk.execute({ operations: [{ kind: 'background_update', patch: { wallpaper, color: '#ffeedd', showGrid: true } }] });
    const restored = await decodeDeskFile(await encodeDeskFile(desk));
    assert.deepEqual(restored.settings.background, { wallpaper, color: '#ffeedd', showGrid: true });
    desk.execute({ operations: [{ kind: 'background_update', patch: { color: null } }] });
    assert.equal(desk.settingsSnapshot().background.wallpaper, wallpaper); assert.equal(desk.settingsSnapshot().background.showGrid, true);
  }
  const desk = new Desk(), settings = desk.settingsSnapshot();
  const { background: _background, ...older } = settings;
  desk.replaceDocument({ objects: [], settings: older });
  assert.deepEqual(desk.settingsSnapshot(), settings);
});
