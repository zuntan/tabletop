import type { DeskObject } from './model';
import { element as svg } from './diagram-drawing';
import { stampPattern, type Stamp } from './stamp-values';

/** Body-relative geometry. Decoration never changes object bounds or hit targets. */
export function stampLayout(width: number, height: number, compact: boolean, shape: string) {
  const ratio = shape === 'square' ? 2.1 : 1;
  const w = Math.min(width * (compact ? .3 : .78), height * (compact ? .34 : .78) * ratio);
  const h = w / ratio;
  return { width: w, height: h, x: compact ? width - w * .58 - Math.min(4, width * .04) : width / 2,
    y: compact ? height - h * .58 - Math.min(4, height * .04) : height / 2 };
}
export function stampArtwork(stamp: Stamp) {
  const pattern = stampPattern(stamp.designId), rectangular = pattern.shape === 'square';
  const g = svg('g', { fill: 'none', stroke: pattern.color, opacity: pattern.opacity,
    'stroke-width': 3, 'stroke-linejoin': 'round', 'pointer-events': 'none' });
  const text = (value: string, y: number, size: number, maxWidth: number, family = 'serif') => {
    const node = svg('text', { x: 0, y, fill: pattern.color, stroke: 'none', 'text-anchor': 'middle',
      'dominant-baseline': 'middle', 'font-size': size, 'font-weight': 800, 'font-family': family });
    node.textContent = value;
    // Bound arbitrary supplementary strings without interpreting them as dates or markup.
    if ([...value].length * size * .8 > maxWidth) {
      node.setAttribute('textLength', String(maxWidth)); node.setAttribute('lengthAdjust', 'spacingAndGlyphs');
    }
    g.append(node);
  };
  if (rectangular) {
    g.append(svg('rect', { x: -99, y: -44, width: 198, height: 88, rx: 5 }),
      svg('rect', { x: -94, y: -39, width: 188, height: 78, rx: 2, 'stroke-width': 1 }));
    text(pattern.title, stamp.text ? -10 : 2, 33, 176, 'sans-serif');
    if (stamp.text) { g.append(svg('path', { d: 'M -86 12 H 86', 'stroke-width': 1 })); text(stamp.text, 27, 16, 170, 'monospace'); }
  } else {
    if (pattern.shape === 'flower') {
      // Separate, rounded pentagonal petals, rather than a sinusoidal scalloped ring.
      for (let i = 0; i < 10; i++) g.append(svg('path', {
        d: 'M -10 -32 Q -17 -42 -10 -48 Q 0 -55 10 -48 Q 17 -42 10 -32',
        transform: `rotate(${i * 36})`, 'stroke-width': 3.5,
      }));
      g.append(svg('circle', { r: 33, 'stroke-width': 3.5 }));
      const spiral = Array.from({ length: 121 }, (_, i) => {
        const angle = i / 120 * Math.PI * 4.1, r = 2 + i / 120 * 23;
        return `${i ? 'L' : 'M'}${Math.cos(angle) * r},${Math.sin(angle) * r}`;
      }).join(' ');
      g.append(svg('path', { d: spiral, 'stroke-width': 3.5, 'stroke-linecap': 'round' }));
      if (stamp.text) text(stamp.text, 43, 8, 56, 'monospace');
    } else if (pattern.shape === 'smile') {
      const points = Array.from({ length: 240 }, (_, i) => {
        const a = i * Math.PI / 120, r = 44 + 4 * Math.cos(a * 12);
        return `${i ? 'L' : 'M'}${Math.cos(a) * r},${Math.sin(a) * r}`;
      }).join(' ');
      g.append(svg('path', { d: points + ' Z' }), svg('circle', { r: 38, 'stroke-width': 1 }));
      g.append(svg('path', { d: 'M -22 -5 Q -15 -17 -8 -5 M 8 -5 Q 15 -17 22 -5 M -22 8 Q 0 35 22 8',
        'stroke-width': 4, 'stroke-linecap': 'round' }));
      if (stamp.text) text(stamp.text, 29, 8, 52, 'monospace');
    } else if (pattern.shape === 'words') {
      // Five broad cherry-blossom petals; each tip has a small inward notch.
      const polar = (radius: number, degrees: number) => {
        const a = degrees * Math.PI / 180; return `${Math.cos(a) * radius},${Math.sin(a) * radius}`;
      };
      let blossom = `M ${polar(37, -126)}`;
      for (let i = 0; i < 5; i++) {
        const a = -90 + i * 72;
        blossom += ` C ${polar(51, a - 32)} ${polar(54, a - 16)} ${polar(50, a - 5)}`;
        blossom += ` L ${polar(44, a)} L ${polar(50, a + 5)}`;
        blossom += ` C ${polar(54, a + 16)} ${polar(51, a + 32)} ${polar(37, a + 36)}`;
      }
      g.append(svg('path', { d: blossom + ' Z', 'stroke-width': 2.5 }));
      text('たいへん', -20, 17, 70, 'sans-serif');
      text('よくでき', 1, 19, 76, 'sans-serif');
      text('ました', 22, 19, 64, 'sans-serif');
      if (stamp.text) text(stamp.text, 35, 7, 52, 'monospace');
    } else {
      g.append(svg('circle', { r: 46 }), svg('circle', { r: 41, 'stroke-width': 1 }));
      text(pattern.title, stamp.text ? -9 : 2, pattern.title.length === 1 ? 49 : 32, 74);
      if (stamp.text) { g.append(svg('path', { d: 'M -37 13 H 37', 'stroke-width': 1 })); text(stamp.text, 26, 11, 65, 'monospace'); }
    }
  }
  return g;
}
export function drawStamp(group: SVGGElement, object: DeskObject, compact: boolean) {
  group.querySelector('[data-stamp]')?.remove();
  if (object.type !== 'text' || !object.stamp) return;
  const pattern = stampPattern(object.stamp.designId);
  const layout = stampLayout(object.width, object.height, compact, pattern.shape);
  const layer = svg('g', { 'data-stamp': object.stamp.designId, 'data-compact': String(compact),
    'pointer-events': 'none', 'aria-hidden': 'true',
    transform: `translate(${layout.x} ${layout.y}) rotate(${object.stamp.angle}) scale(${layout.width / (pattern.shape === 'square' ? 210 : 100)})` });
  layer.append(stampArtwork(object.stamp)); group.append(layer);
}
