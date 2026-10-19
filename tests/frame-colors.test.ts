import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Desk } from '../src/model';
import { frameColors } from '../src/frame-colors';
import { encodeDeskFile, decodeDeskFile } from '../src/desk-file';

test('frame colors follow wallpaper, allow independent overrides and share desk save/undo', async () => {
  const desk = new Desk();
  desk.execute({ operations: [{ kind: 'background_update', patch: { wallpaper: 'cutting-mat' } }] });
  assert.deepEqual(frameColors(desk.settingsSnapshot().background), { selection: '#facc15', pointing: '#e879f9' });
  desk.execute({ operations: [{ kind: 'background_update', patch: { selectionColor: '#ff0000', pointingColor: '#00ffff' } }] });
  const saved = await decodeDeskFile(await encodeDeskFile(desk));
  assert.deepEqual(frameColors(saved.settings.background), { selection: '#ff0000', pointing: '#00ffff' });
  desk.execute({ operations: [{ kind: 'background_update', patch: { wallpaper: 'charcoal' } }] });
  assert.deepEqual(frameColors(desk.settingsSnapshot().background), { selection: '#60a5fa', pointing: '#a3e635' });
  desk.undo(); assert.deepEqual(desk.settingsSnapshot().background, saved.settings.background);
  desk.execute({ operations: [{ kind: 'background_update', patch: { wallpaper: 'wood', pointingColor: '#123456' } }] });
  assert.deepEqual(frameColors(desk.settingsSnapshot().background), { selection: '#1d4ed8', pointing: '#123456' });
  desk.execute({ operations: [{ kind: 'background_update', patch: { pointingColor: null } }] });
  assert.equal(frameColors(desk.settingsSnapshot().background).pointing, '#7c3aed');
});
