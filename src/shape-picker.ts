import { t } from './i18n';
import { uiText, uiAttribute } from './i18n/dom';
import { addPresetPalette } from './number-presets';
import { shapePaths, shapeTypes, type ShapeType } from './shape-definitions';
import { iconButton } from './toolbar';
export function shapeSample(type: ShapeType) {
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '-3 -3 106 66'); svg.setAttribute('width', '36'); svg.setAttribute('height', '24'); svg.setAttribute('aria-hidden', 'true');
  const paths = shapePaths(type, 100, 60);
  const append = (tag: string, attrs: Record<string, string | number>) => {
    const node = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries({ fill: 'none', stroke: 'currentColor', 'stroke-width': 3, ...attrs })) node.setAttribute(key, String(value));
    svg.append(node);
  };
  if (paths) { append('path', { d: paths.outline }); if ('detail' in paths && paths.detail) append('path', { d: paths.detail }); }
  else if (type === 'ellipse') append('ellipse', { cx: 50, cy: 30, rx: 50, ry: 30 });
  else append('rect', { width: 100, height: 60, rx: type === 'roundedRect' ? 12 : 0 });
  return svg;
}
export function createShapePicker(anchor: HTMLButtonElement, create: (type: ShapeType) => void) {
  const select = document.createElement('select'); select.hidden = true;
  for (const type of shapeTypes) { const option = document.createElement('option'); option.value = type; select.append(option); }
  anchor.after(select);
  const { menu, choices, wrapper } = addPresetPalette(select, shapeTypes, t('tools:shapesLabel'));
  menu.dataset.add = 'rect'; iconButton(menu, '▭', t('tools:addShape')); uiText(menu.querySelector('.tool-caption')!, 'tools:shapesLabel');
  uiAttribute(menu, 'aria-label', 'tools:shapeChoices'); uiAttribute(menu, 'title', 'tools:shapeChoices'); anchor.replaceWith(menu); wrapper.hidden = true;
  for (const button of choices.querySelectorAll<HTMLButtonElement>('button')) {
    const type = button.dataset.value as ShapeType;
    button.replaceChildren(shapeSample(type), uiText(document.createElement('span'), `tools:shapes.${type}`)); uiAttribute(button, 'aria-label', `tools:shapes.${type}`);
  }
  select.onchange = () => create(select.value as ShapeType);
}
export function createTextFitPicker(select: HTMLSelectElement) {
  const labels = { auto: 'shell:autoText', shrink: 'shell:shrinkText' } as const;
  const { menu, choices, wrapper } = addPresetPalette(select, ['auto', 'shrink'], t('shell:textFit'));
  select.hidden = true; wrapper.classList.add('line-style-picker');
  for (const button of choices.querySelectorAll<HTMLButtonElement>('button')) {
    const key = labels[button.dataset.value as keyof typeof labels]; uiText(button, key); uiAttribute(button, 'aria-label', key);
  }
  return () => { uiText(menu, labels[select.value as keyof typeof labels] ?? 'shell:fixedText'); };
}
