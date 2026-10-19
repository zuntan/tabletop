import { addPresetPalette } from './number-presets';
import { drawConnectorMarker, type EndpointShape } from './connector-markers';

const names = { none: 'なし', arrow: '矢印', circle: '丸', diamond: 'ひし形' } as const;
export function createEndpointPicker(select: HTMLSelectElement, label: string, side: 'start' | 'end') {
  const { menu, choices, wrapper, popup } = addPresetPalette(select, Object.keys(names), label);
  select.hidden = true; wrapper.classList.add('line-style-picker'); popup.classList.add('line-style-palette');
  function sample(shape: EndpointShape) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (const [key, value] of Object.entries({ viewBox: '0 0 48 20', width: '48', height: '20', 'aria-hidden': 'true' })) svg.setAttribute(key, value);
    const line = document.createElementNS(svg.namespaceURI, 'line');
    for (const [key, value] of Object.entries({ x1: '6', y1: '10', x2: '42', y2: '10', stroke: 'currentColor', 'stroke-width': '1' })) line.setAttribute(key, value);
    svg.append(line); drawConnectorMarker(svg, shape, side === 'start' ? 6 : 42, 10, side === 'start' ? Math.PI : 0, 12, 'currentColor', side);
    return svg;
  }
  for (const button of choices.querySelectorAll<HTMLButtonElement>('button')) {
    const value = button.dataset.value as EndpointShape;
    button.replaceChildren(sample(value), document.createTextNode(names[value])); button.setAttribute('aria-label', names[value]);
  }
  return () => {
    const value = select.value as EndpointShape;
    menu.replaceChildren(sample(value), document.createTextNode(names[value])); menu.title = `${label}：${names[value]}`;
  };
}
