/** Compact palette triggers; the accessible name remains available as a tooltip. */
export function stationeryButton(button: HTMLButtonElement, kind: 'stamp' | 'reaction' | 'prop' | 'sticker', label: string) {
  const artwork = {
    sticker: '<circle cx="12" cy="12" r="8" fill="currentColor" stroke="none"/>',
    stamp: '<circle cx="12" cy="12" r="9"/><text x="12" y="16" text-anchor="middle" fill="currentColor" stroke="none" font-size="12" font-weight="600">済</text>',
    reaction: '<circle cx="12" cy="12" r="9"/><path d="M8 9h.01M16 9h.01M8 14q4 5 8 0"/>',
    prop: '<path d="M5 9h12v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4ZM17 10h2a3 3 0 0 1 0 6h-2M8 3v3M12 2v4M16 3v3"/>',
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '24'); svg.setAttribute('height', '24');
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = artwork[kind];
  button.replaceChildren(svg); button.classList.add('stationery-button');
  button.title = label; button.setAttribute('aria-label', label);
}
