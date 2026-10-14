import type { DeskObject, Operation } from './model';
import { reactions, reactionNames, type Reaction } from './reaction-values';
import { bounds, isConnector } from './geometry';
import { labelVisualBounds } from './label-description';
import { element } from './diagram-drawing';

/** A mixed selection adds to missing targets; an all-active selection removes from all. */
export function reactionOperations(objects: DeskObject[], reaction: Reaction): Operation[] {
  const remove = objects.every(object => object.reactions?.includes(reaction));
  return objects.flatMap(object => {
    const current = object.reactions ?? [];
    if (!remove && current.includes(reaction)) return [];
    return [{ kind: 'update' as const, id: object.id,
      patch: { reactions: remove ? current.filter(value => value !== reaction) : [...current, reaction] } }];
  });
}

export function createReactionControls(container: HTMLElement, selected: () => DeskObject[], apply: (operations: Operation[]) => void) {
  container.setAttribute('role', 'group'); container.setAttribute('aria-label', 'リアクション');
  const caption = document.createElement('small'); caption.textContent = 'リアクション（選択した対象に付け外し）';
  const buttons = reactions.map(reaction => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = reaction;
    button.dataset.reaction = reaction; button.setAttribute('aria-label', `${reaction} ${reactionNames[reaction]}`);
    button.title = `${reactionNames[reaction]}を付け外し`;
    button.onclick = () => apply(reactionOperations(selected(), reaction));
    container.append(button); return button;
  });
  container.prepend(caption);
  // Preserve native Space activation instead of the canvas pan shortcut.
  container.addEventListener('keydown', event => { if (event.code === 'Space') event.stopPropagation(); });
  return {
    update(objects: DeskObject[]) {
      container.hidden = !objects.length;
      buttons.forEach((button, index) => {
        const active = objects.filter(object => object.reactions?.includes(reactions[index])).length;
        button.setAttribute('aria-pressed', active && active === objects.length ? 'true' : active ? 'mixed' : 'false');
      });
    },
  };
}

/** Badges are inert and sit below the object, away from media open controls. */
export function drawReactions(group: SVGGElement, object: DeskObject, descriptionsVisible: boolean) {
  const active = reactions.filter(reaction => object.reactions?.includes(reaction));
  if (!active.length) return;
  const visual = isConnector(object) ? bounds(object) : labelVisualBounds(object, descriptionsVisible);
  const x = visual.x - object.x + Math.max(0, visual.width - active.length * 28);
  const y = visual.y - object.y + visual.height + 8;
  const badges = element('g', { 'data-reactions': object.id, 'pointer-events': 'none', 'aria-hidden': 'true' });
  active.forEach((reaction, index) => {
    badges.append(element('rect', { x: x + index * 28, y, width: 24, height: 24, rx: 8,
      fill: '#ffffff', stroke: '#cbd5e1', 'stroke-width': 1 }));
    const text = element('text', { x: x + index * 28 + 12, y: y + 17, 'font-size': 16,
      'text-anchor': 'middle', 'font-family': 'sans-serif' });
    text.textContent = reaction; badges.append(text);
  });
  group.append(badges);
}
