import { addPresetPalette } from './number-presets';
import { shapeNames, shapePaths, shapeTypes, type ShapeType } from './shape-definitions';
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
  const { menu, choices, wrapper } = addPresetPalette(select, shapeTypes, '図形');
  menu.dataset.add = 'rect'; iconButton(menu, '▭', '図形を追加'); menu.querySelector('.tool-caption')!.textContent = '図形';
  menu.setAttribute('aria-label', '図形の候補'); anchor.replaceWith(menu); wrapper.hidden = true;
  for (const button of choices.querySelectorAll<HTMLButtonElement>('button')) {
    const type = button.dataset.value as ShapeType;
    button.replaceChildren(shapeSample(type), document.createTextNode(shapeNames[type])); button.setAttribute('aria-label', shapeNames[type]);
  }
  select.onchange = () => create(select.value as ShapeType);
}
export function createTextFitPicker(select: HTMLSelectElement) {
  const labels: Record<string, string> = { auto: '完全自動', shrink: '縮小のみ' };
  const { menu, choices, wrapper } = addPresetPalette(select, ['auto', 'shrink'], '文字サイズ調整');
  select.hidden = true; wrapper.classList.add('line-style-picker');
  for (const button of choices.querySelectorAll<HTMLButtonElement>('button')) {
    button.textContent = labels[button.dataset.value!]; button.setAttribute('aria-label', button.textContent);
  }
  return () => { menu.textContent = labels[select.value] ?? '指定サイズ（既存）'; };
}
