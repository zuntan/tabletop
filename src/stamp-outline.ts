import outlines from './stamp-outlines.json';
import {element} from './diagram-drawing';

type Outline = {width: number; d: string};
const labels: Readonly<Record<string, Outline>> = outlines;
function inherited(node: Element, name: string, fallback: string): string {
  for (let current: Element | null = node; current; current = current.parentElement) {
    const value = current.getAttribute(name);
    if (value !== null) return value;
  }
  return fallback;
}

/** Replace only fixed artwork, after its layout/style is final. Dates remain ordinary SVG text. */
export function outlineStampLabels(root: SVGGElement, allText = false) {
  const nodes = root.querySelectorAll<SVGTextElement>(allText ? 'text' : 'text[data-stamp-fixed]');
  for (const node of nodes) {
    const value = node.textContent ?? '';
    if (!value) { node.removeAttribute('data-stamp-fixed'); continue; }
    const key = JSON.stringify([inherited(node, 'font-family', 'serif'), inherited(node, 'font-weight', '800'), value]);
    const outline = labels[key];
    if (!outline) throw new Error(`Missing fixed stamp outline: ${key}`);
    const size = Number(inherited(node, 'font-size', '16')), scale = size / 1000;
    const requested = node.getAttribute('textLength');
    const width = requested === null ? outline.width * scale : Number(requested);
    const x = Number(node.getAttribute('x') ?? 0), y = Number(node.getAttribute('y') ?? 0);
    const anchor = inherited(node, 'text-anchor', 'start');
    const left = x - (anchor === 'middle' ? width / 2 : anchor === 'end' ? width : 0);
    const group = element('g', {'data-stamp-outline': value});
    for (const attr of node.attributes) if (attr.name !== 'data-stamp-fixed') group.setAttribute(attr.name, attr.value);
    const title = element('title'); title.textContent = value;
    const path = element('path', {d: outline.d, transform: `translate(${left} ${y}) scale(${width / outline.width} ${scale})`});
    // Glyph scaling must not shrink an explicit outline such as the white lettering halo.
    const strokeWidth = node.getAttribute('stroke-width');
    if (strokeWidth !== null) path.setAttribute('stroke-width', String(Number(strokeWidth) / scale));
    group.append(title, path); node.replaceWith(group);
  }
}
