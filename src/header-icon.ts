import { createIcon, type IconName } from './icons';

const icons = {
  eye: 'eye', eyeOff: 'eye-off', clear: 'x', undo: 'arrow-back-up',
  redo: 'arrow-forward-up', save: 'device-floppy', load: 'folder-open',
} as const satisfies Record<string, IconName>;

/** Monochrome icons inherit button colors, including disabled states. */
export function headerIcon(button: HTMLButtonElement, kind: keyof typeof icons, label: string) {
  button.classList.add('header-icon');
  button.title = label; button.setAttribute('aria-label', label);
  button.replaceChildren(createIcon(icons[kind], 20));
}
