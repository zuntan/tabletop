import { t } from './i18n';
import { uiText, uiAttribute } from './i18n/dom';
import { addPresetPalette } from './number-presets';
import { drawConnectorMarker, type EndpointShape } from './connector-markers';

const names = { none: 'shell:none', arrow: 'shell:arrow', circle: 'shell:circle', diamond: 'shell:diamond' } as const;
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
    button.replaceChildren(sample(value), uiText(document.createElement('span'), names[value])); uiAttribute(button, 'aria-label', names[value]);
  }
  return () => {
    const value = select.value as EndpointShape;
    menu.removeAttribute('data-i18n');
    menu.replaceChildren(sample(value), uiText(document.createElement('span'), names[value])); menu.title = `${t(side === 'start' ? 'shell:startMarker' : 'shell:endMarker')}: ${t(names[value])}`;
  };
}
