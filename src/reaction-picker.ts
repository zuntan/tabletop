import { t, languageChangeEvent } from './i18n';
import { uiAttribute } from './i18n/dom';
import { reactionName } from './badge-labels';
import { reactionChoices, reactionSymbolGroups, reactionDisplay, reactionBars, reactionMoons, isReactionBar, type Reaction } from './reaction-values';
import { stationeryButton } from './stationery-button';

/** Stay open while selecting targets; close explicitly with the trigger or Escape. */
export function createReactionButtons(container: HTMLElement, toggle: (reaction: Reaction) => void) {
  const quick = document.createElement('div'); quick.className = 'reaction-quick';
  quick.setAttribute('role', 'group'); uiAttribute(quick,'aria-label','badges:reactionOpen');
  const palette = document.createElement('div'); palette.id = 'reaction-palette'; palette.popover = 'manual';
  palette.setAttribute('role', 'group'); uiAttribute(palette,'aria-label','badges:reactionAll');
  const more = document.createElement('button'); more.type = 'button'; more.id = 'reaction-more'; more.textContent = '';
  stationeryButton(more, 'reaction', t('badges:reactionList'));
  uiAttribute(more,'title','badges:reactionList');uiAttribute(more,'aria-label','badges:reactionList');
  more.setAttribute('aria-expanded', 'false'); more.setAttribute('aria-controls', palette.id);
  more.popoverTargetElement = palette; more.popoverTargetAction = 'toggle';
  const makeButton = (reaction: Reaction) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = reactionDisplay(reaction);
    button.classList.toggle('reaction-bar',isReactionBar(reaction));button.dataset.reaction = reaction;
    const translate = () => { button.setAttribute('aria-label', `${reaction} ${reactionName(reaction)}`); button.title = t('badges:reactionToggle', { name: reactionName(reaction) }); };
    translate(); document.addEventListener(languageChangeEvent, translate); button.onclick = () => toggle(reaction);
    return button;
  };

  const paletteButtons = reactionChoices.map(makeButton);
  quick.append(more);
  const symbols=paletteButtons.filter(button=>!reactionBars.some(v=>v===button.dataset.reaction)&&!reactionMoons.some(v=>v===button.dataset.reaction));
  const strip=(name:string,values:readonly string[])=>{const row=document.createElement('div');row.className='reaction-level-strip '+name;row.setAttribute('role','group');uiAttribute(row,'aria-label',name==='reaction-bars'?'badges:bars':'badges:moons');row.append(...paletteButtons.filter(button=>values.includes(button.dataset.reaction!)));return row;};
  const groups=reactionSymbolGroups.map(values=>{const row=document.createElement('div');row.className='reaction-symbol-group';row.append(...symbols.filter(button=>(values as readonly string[]).includes(button.dataset.reaction!)));return row;});
  palette.append(...groups,strip('reaction-bars',reactionBars),strip('reaction-moons',reactionMoons));container.append(quick, palette);
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
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !palette.matches(':popover-open')) return;
    // Composition and an active editor get the first Escape for their own cancellation.
    if (event.isComposing || event.keyCode === 229) return;
    if (event.target instanceof Element && event.target.closest('.inline-editor')) return;
    event.preventDefault(); event.stopPropagation(); palette.hidePopover(); more.focus();
  }, true);
  window.addEventListener('resize', () => { if (palette.matches(':popover-open')) position(); });
  window.addEventListener('scroll', () => { if (palette.matches(':popover-open')) position(); }, true);
  return paletteButtons;
}
