import { reactionChoices, reactionNames, type Reaction } from './reaction-values';

/** Native auto popover provides outside-click/Escape dismissal and keyboard focus handling. */
export function createReactionButtons(container: HTMLElement, toggle: (reaction: Reaction) => void) {
  const quick = document.createElement('div'); quick.className = 'reaction-quick';
  quick.setAttribute('role', 'group'); quick.setAttribute('aria-label', 'よく使うリアクション');
  const palette = document.createElement('div'); palette.id = 'reaction-palette'; palette.popover = 'auto';
  palette.setAttribute('role', 'group'); palette.setAttribute('aria-label', 'すべてのリアクション');
  const more = document.createElement('button'); more.type = 'button'; more.id = 'reaction-more'; more.textContent = '＋';
  more.setAttribute('aria-label', 'リアクション一覧'); more.title = 'リアクション一覧';
  more.setAttribute('aria-expanded', 'false'); more.setAttribute('aria-controls', palette.id);
  more.popoverTargetElement = palette; more.popoverTargetAction = 'toggle';
  const makeButton = (reaction: Reaction) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = reaction;
    button.dataset.reaction = reaction; button.setAttribute('aria-label', `${reaction} ${reactionNames[reaction]}`);
    button.title = `${reactionNames[reaction]}を付け外し`; button.onclick = () => toggle(reaction);
    return button;
  };
  const quickButtons = reactionChoices.slice(0, 7).map(makeButton);
  const paletteButtons = reactionChoices.map(makeButton);
  quick.append(...quickButtons, more); palette.append(...paletteButtons); container.append(quick, palette);
  const position = () => {
    const anchor = more.getBoundingClientRect();
    const width = palette.offsetWidth || 238, height = palette.offsetHeight || 110;
    palette.style.left = `${Math.max(8, Math.min(anchor.left, innerWidth - width - 8))}px`;
    palette.style.top = `${Math.max(8, anchor.bottom + height + 6 <= innerHeight ? anchor.bottom + 6 : anchor.top - height - 6)}px`;
  };
  palette.addEventListener('beforetoggle', event => { if ((event as ToggleEvent).newState === 'open') position(); });
  palette.addEventListener('toggle', () => {
    const open = palette.matches(':popover-open'); more.setAttribute('aria-expanded', String(open));
    if (open) position();
  });
  container.addEventListener('keydown', event => {
    if (event.key === 'Escape' && palette.matches(':popover-open')) event.stopPropagation();
  });
  window.addEventListener('resize', () => { if (palette.matches(':popover-open')) position(); });
  window.addEventListener('scroll', () => { if (palette.matches(':popover-open')) position(); }, true);
  return [...quickButtons, ...paletteButtons];
}
