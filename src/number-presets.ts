export const numberPresets = {
  strokeWidth: [1, 2, 4, 8, 16],
  fontSize: [12, 16, 24, 32, 48],
  fillOpacity: [100, 90, 70, 50, 30],
  cornerRadius: [0, 4, 8, 16, 24],
  padding: [0, 8, 16, 24, 32],
} as const;

/** A small palette of values; keep the existing input and its commit behavior. */
export function addNumberPresets(input: HTMLInputElement, values: readonly number[], label: string) {
  return addPresetPalette(input, values.map(String), label);
}

export function addPresetPalette(input: HTMLInputElement | HTMLSelectElement, values: readonly string[], label: string) {
  const wrapper = document.createElement('span'); wrapper.className = 'number-presets';
  const menu = document.createElement('button'); menu.type = 'button'; menu.className = 'number-preset-menu';
  menu.textContent = '候補';
  menu.setAttribute('aria-label', `${label}の候補`); menu.title = `${label}の候補`;
  const popup = document.createElement('div'); popup.className = 'number-preset-palette'; popup.popover = 'auto';
  popup.setAttribute('role', 'dialog'); popup.setAttribute('aria-label', `${label}の候補`);
  const heading = document.createElement('div'); heading.className = 'number-preset-heading'; heading.textContent = label;
  const choices = document.createElement('div'); choices.className = 'number-preset-choices';
  popup.append(heading, choices); document.body.append(popup);
  menu.setAttribute('aria-haspopup', 'dialog'); menu.setAttribute('aria-expanded', 'false');
  let anchorTop = 0, anchorLeft = 0;
  const hide = () => { if (popup.matches(':popover-open')) popup.hidePopover(); menu.setAttribute('aria-expanded', 'false'); };
  for (const value of values) {
    const choice = document.createElement('button'); choice.type = 'button'; choice.textContent = String(value);
    choice.dataset.value = String(value);
    choice.onclick = () => {
      if (input.disabled) { hide(); return; }
      input.value = String(value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      hide(); menu.focus({ preventScroll: true });
    };
    choices.append(choice);
  }
  input.before(wrapper); wrapper.append(input, menu);
  menu.disabled = input.disabled;
  new MutationObserver(() => {
    menu.disabled = input.disabled;
    if (input.disabled || !menu.checkVisibility()) hide();
  }).observe(input, { attributes: true, attributeFilter: ['disabled'] });
  menu.onclick = event => {
    event.preventDefault();
    if (popup.matches(':popover-open')) { hide(); return; }
    if (input.disabled) return;
    choices.querySelectorAll<HTMLButtonElement>('button').forEach(choice => choice.setAttribute('aria-pressed', String(input.value === choice.dataset.value)));
    popup.showPopover();
    menu.setAttribute('aria-expanded', 'true');
    const anchor = menu.getBoundingClientRect(), rect = popup.getBoundingClientRect();
    anchorTop = anchor.top; anchorLeft = anchor.left;
    popup.style.left = `${Math.max(8, Math.min(anchor.right - rect.width, innerWidth - rect.width - 8))}px`;
    popup.style.top = `${Math.max(8, Math.min(anchor.bottom + 6, innerHeight - rect.height - 8))}px`;
    (choices.querySelector<HTMLButtonElement>('[aria-pressed="true"]') ?? choices.querySelector<HTMLButtonElement>('button'))?.focus({ preventScroll: true });
  };
  popup.addEventListener('toggle', () => menu.setAttribute('aria-expanded', String(popup.matches(':popover-open'))));
  popup.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); hide(); menu.focus({ preventScroll: true }); }
  });
  window.addEventListener('resize', hide);
  document.addEventListener('scroll', event => {
    if (!popup.matches(':popover-open') || event.target instanceof Node && popup.contains(event.target)) return;
    // A click can scroll the trigger into view before opening, with its scroll event delivered later.
    const anchor = menu.getBoundingClientRect();
    if (Math.abs(anchor.top - anchorTop) > 0.5 || Math.abs(anchor.left - anchorLeft) > 0.5) hide();
  }, true);
  return { menu, choices, popup, wrapper };
}

export function addFormNumberPresets(form: HTMLFormElement) {
  for (const [name, values] of Object.entries(numberPresets)) {
    const input = form.elements.namedItem(name) as HTMLInputElement | null;
    if (input) addNumberPresets(input, values, input.closest('label')?.firstChild?.textContent?.trim() || name);
  }
}
