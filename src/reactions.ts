import type { DeskObject, Operation } from './model';
import { reactionChoices, hasReaction, canonicalReaction, type Reaction } from './reaction-values';
import { createReactionButtons } from './reaction-picker';
import { bounds, isConnector } from './geometry';
import { labelVisualBounds } from './label-description';
import { element } from './diagram-drawing';

/** A mixed selection adds to missing targets; an all-active selection removes from all. */
export function reactionOperations(objects: DeskObject[], reaction: Reaction): Operation[] {
  const remove = objects.every(object => hasReaction(object.reactions, reaction));
  return objects.flatMap(object => {
    const current = object.reactions ?? [];
    if (!remove && hasReaction(current, reaction)) return [];
    return [{ kind: 'update' as const, id: object.id,
      patch: { reactions: remove ? current.filter(value => canonicalReaction(value) !== canonicalReaction(reaction)) : [...current, canonicalReaction(reaction)] } }];
  });
}

export function createReactionControls(container: HTMLElement, selected: () => DeskObject[], apply: (operations: Operation[]) => void) {
  container.setAttribute('role', 'group'); container.setAttribute('aria-label', 'リアクション');

  const buttons = createReactionButtons(container, reaction => apply(reactionOperations(selected(), reaction)));

  // Preserve native Space activation instead of the canvas pan shortcut.
  container.addEventListener('keydown', event => { if (event.code === 'Space') event.stopPropagation(); });
  return {
    update(objects: DeskObject[]) {
      container.hidden = false;
      const more = container.querySelector<HTMLButtonElement>('#reaction-more')!;
      more.disabled = !objects.length;
      if (!objects.length) container.querySelector<HTMLElement>('#reaction-palette')!.hidePopover();
      buttons.forEach(button => {
        button.disabled = !objects.length;
        const active = objects.filter(object => hasReaction(object.reactions, button.dataset.reaction as Reaction)).length;
        button.setAttribute('aria-pressed', active && active === objects.length ? 'true' : active ? 'mixed' : 'false');
      });
    },
  };
}

/** Badges are inert and sit below the object, away from media open controls. */
export function drawReactions(group: SVGGElement, object: DeskObject, descriptionsVisible: boolean) {
  const active = reactionChoices.filter(reaction => hasReaction(object.reactions, reaction));
  if (!active.length) return;
  const visual = isConnector(object) ? bounds(object) : labelVisualBounds(object, descriptionsVisible);
  const x = visual.x - object.x + Math.max(0, visual.width - Math.min(active.length, 7) * 28);
  const y = visual.y - object.y + visual.height + 8;
  const badges = element('g', { 'data-reactions': object.id, 'pointer-events': 'none', 'aria-hidden': 'true' });
  active.forEach((reaction, index) => {
    const bx = x + index % 7 * 28, by = y + Math.floor(index / 7) * 28;
    badges.append(element('rect', { x: bx, y: by, width: 24, height: 24, rx: 8,
      fill: '#ffffff', stroke: '#cbd5e1', 'stroke-width': 1 }));
    const text = element('text', { x: bx + 12, y: by + 17, 'font-size': 16,
      'text-anchor': 'middle', 'font-family': 'sans-serif' });
    text.textContent = reaction; badges.append(text);
  });
  group.append(badges);
}
