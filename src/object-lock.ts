import { z } from 'zod';
import type { DeskObject, Operation } from './model';

export const lockFields = {
  locked: z.boolean(),
  actor: z.string().min(1).max(100).default('agent-01'),
  expectedRevision: z.number().int().nonnegative().optional(),
};
export const MAX_LOCK_TARGETS = 200;
export function lockOperations(objects: DeskObject[], locked: boolean): Operation[] {
  if (!objects.length) throw new Error('No lock targets. Point at objects explicitly; the whole desk is never inferred.');
  if (objects.length > MAX_LOCK_TARGETS) throw new Error(`Lock supports at most ${MAX_LOCK_TARGETS} targets per atomic command.`);
  return objects.filter(object => !!object.locked !== locked).map(object => ({ kind: 'update', id: object.id, patch: { locked } }));
}
export function lockSelectionState(objects: DeskObject[]) {
  const count = objects.filter(object => object.locked).length;
  return { disabled: !objects.length, pressed: count && count !== objects.length ? 'mixed' : String(!!count),
    nextLocked: count !== objects.length };
}
