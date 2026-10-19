import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';
import { Desk, objectSchema } from '../src/model';
import { decodeDeskFile, encodeDeskFile } from '../src/desk-file';

test('all archived desks keep their objects and legacy arrow intent in canonical lines', async () => {
  const root = new URL('../docs/desk-snapshots/', import.meta.url);
  for (const name of (await readdir(root)).filter(name => name.endsWith('.tabletop'))) {
    const bytes = await readFile(new URL(name, root));
    const old = JSON.parse(strFromU8(unzipSync(bytes)['manifest.json']));
    const decoded = await decodeDeskFile(bytes);
    assert.equal(decoded.objects.length, old.objects.length, name);
    for (const before of old.objects) {
      const after = decoded.objects.find(object => object.id === before.id)!;
      assert.ok(after, `${name}: ${before.id}`);
      if (before.type === 'line' || before.type === 'arrow') {
        assert.equal(after.type, 'line');
        assert.equal(after.startMarker, before.startMarker ?? 'none');
        assert.equal(after.endMarker, before.endMarker ?? (before.type === 'arrow' ? 'arrow' : 'none'));
        assert.equal(after.strokeWidth, before.strokeWidth);
      }
    }
  }
});

test('endpoint pairs persist, undo and remain independent of geometry and bindings', async () => {
  const desk = new Desk();
  desk.execute({ operations: [
    { kind: 'add', object: { id: 'shape', type: 'rect' } },
    { kind: 'add', object: { id: 'edge', type: 'arrow', x2: 500, y2: 200, startBinding: { objectId: 'shape', anchor: 'right' } } },
  ] });
  const before = desk.get('edge');
  for (const startMarker of ['none', 'arrow', 'circle', 'diamond'] as const) {
    for (const endMarker of ['none', 'arrow', 'circle', 'diamond'] as const) {
      desk.execute({ operations: [{ kind: 'update', id: 'edge', patch: { startMarker, endMarker } }] });
      const decoded = await decodeDeskFile(await encodeDeskFile(desk));
      const edge = decoded.objects.find(object => object.id === 'edge')!;
      assert.equal(edge.type, 'line'); assert.equal(edge.startMarker, startMarker); assert.equal(edge.endMarker, endMarker);
      for (const key of ['x', 'y', 'x2', 'y2', 'startBinding'] as const) assert.deepEqual(edge[key], before[key]);
      assert.equal(decoded.objects.find(object => object.id === 'shape')!.startMarker, undefined);
    }
  }
  desk.undo(); assert.equal(desk.get('edge').endMarker, 'circle');
  desk.redo(); assert.equal(desk.get('edge').endMarker, 'diamond');
  assert.throws(() => objectSchema.parse({ id: 'invalid', type: 'line', startMarker: null }));
});
