import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Desk, objectSchema } from '../src/model';
import { reactionOperations } from '../src/reactions';
import { canonicalReaction, hasReaction, type Reaction } from '../src/reaction-values';

for (const [legacy, emoji] of [['○', '⭕'], ['✕', '❌']] as [Reaction, Reaction][]) {
  test(`legacy ${legacy} stays stored and is controlled by ${emoji}`, () => {
    const desk = new Desk();
    desk.execute({ operations: [{ kind: 'add', object: objectSchema.parse({ id: 'legacy', type: 'text', reactions: [legacy, '💡'] }) }] });
    assert.equal(canonicalReaction(legacy), emoji);
    assert.equal(hasReaction(desk.get('legacy').reactions, emoji), true);
    assert.equal(objectSchema.safeParse({ id: 'duplicate', type: 'text', reactions: [legacy, emoji] }).success, false);
    desk.execute({ operations: reactionOperations(desk.snapshot(), '😊') });
    assert.deepEqual(desk.get('legacy').reactions, [legacy, '💡', '😊']);
    desk.execute({ operations: reactionOperations(desk.snapshot(), emoji) });
    assert.deepEqual(desk.get('legacy').reactions, ['💡', '😊']);
    desk.undo(); assert.deepEqual(desk.get('legacy').reactions, [legacy, '💡', '😊']);
    desk.redo(); desk.execute({ operations: reactionOperations(desk.snapshot(), emoji) });
    assert.deepEqual(desk.get('legacy').reactions, ['💡', '😊', emoji]);
  });
}
