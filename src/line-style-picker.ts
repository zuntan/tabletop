import { addPresetPalette } from './number-presets';

const styles = { solid: '実線', dashed: '破線', dotted: '点線' } as const;
type LineStyle = keyof typeof styles;

function sample(style: LineStyle) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [key, value] of Object.entries({ viewBox: '0 0 48 12', width: '48', height: '12', 'aria-hidden': 'true' })) svg.setAttribute(key, value);
  const line = document.createElementNS(svg.namespaceURI, 'line');
  for (const [key, value] of Object.entries({ x1: '3', y1: '6', x2: '45', y2: '6', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round' })) line.setAttribute(key, value);
  if (style !== 'solid') line.setAttribute('stroke-dasharray', style === 'dashed' ? '8 5' : '1 5');
  svg.append(line); return svg;
}

export function createLineStylePicker(select: HTMLSelectElement) {
  const { menu, choices, wrapper, popup } = addPresetPalette(select, Object.keys(styles), '線種');
  select.hidden = true; wrapper.classList.add('line-style-picker'); popup.classList.add('line-style-palette');
  for (const button of choices.querySelectorAll<HTMLButtonElement>('button')) {
    const value = button.dataset.value as LineStyle;
    button.replaceChildren(sample(value), document.createTextNode(styles[value]));
    button.setAttribute('aria-label', styles[value]);
  }
  return () => {
    const value = select.value as LineStyle;
    menu.replaceChildren(sample(value), document.createTextNode(styles[value]));
    menu.title = `線種：${styles[value]}`;
  };
}
