const paths = {
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  eyeOff: 'm3 3 18 18 M10 5c7-1 12 7 12 7s-1 2-3 4 M6 6c-3 2-4 6-4 6s4 7 10 7c2 0 3-1 4-1',
  clear: 'm6 6 12 12 M18 6 6 18',
  undo: 'M9 5 4 10l5 5 M4 10h10a6 6 0 0 1 0 12',
  redo: 'm15 5 5 5-5 5 M20 10H10a6 6 0 0 0 0 12',
  save: 'M5 3h12l4 4v14H3V3h2 M7 3v6h10V3 M7 21v-8h10v8 M14 5v2',
  load: 'M3 9V5h6l2 3h10 M3 9h19l-3 12H3V9 M12 11v6 m-3-3 3 3 3-3',
} as const;

/** Monochrome icons inherit the button color, including themed and disabled states. */
export function headerIcon(button: HTMLButtonElement, kind: keyof typeof paths, label: string) {
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [key, value] of Object.entries({ viewBox: '0 0 24 24', width: '20', height: '20', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' })) {
    icon.setAttribute(key, value);
  }
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', paths[kind]); icon.append(path);
  button.classList.add('header-icon');
  button.title = label; button.setAttribute('aria-label', label);
  button.replaceChildren(icon);
}
