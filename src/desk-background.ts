import type { Settings } from './settings';
import { element } from './diagram-drawing';

export const wallpaperUnderlayColor = '#808080';

export const wallpaperColors = {
  none: '#f8fafc', wood: '#dfc49e', 'cutting-mat': '#315e50', 'pink-notebook': '#fff0f4', charcoal: '#252b33',
} as const;

/** Built-in SVG textures only; no assets, requests, UI theme or document objects. */
export function createDeskBackground(canvas: SVGSVGElement) {
  const defs = canvas.querySelector('defs')!;
  const pattern = element('pattern', { id: 'desk-surface-pattern', patternUnits: 'userSpaceOnUse' });
  defs.append(pattern);
  const base = canvas.querySelector<SVGRectElement>('#desk-background')!;
  const texture = canvas.querySelector<SVGRectElement>('#desk-wallpaper')!;
  const grid = canvas.querySelector<SVGRectElement>('#desk-grid')!;
  // Composite the whole wallpaper once, so its texture does not fade independently.
  const underlay = element('rect', { id: 'desk-underlay', width: '100%', height: '100%', fill: wallpaperUnderlayColor, 'aria-hidden': 'true' });
  const surface = element('g', { id: 'desk-surface', 'aria-hidden': 'true' });
  base.before(underlay, surface);
  surface.append(base, texture, grid);
  for (const node of [base, texture, grid]) node.setAttribute('aria-hidden', 'true');
  let previous = '';
  function draw(wallpaper: Settings['background']['wallpaper']) {
    pattern.replaceChildren();
    const path = (d: string, stroke: string, opacity: number, width = 1) =>
      pattern.append(element('path', { d, fill: 'none', stroke, 'stroke-opacity': opacity, 'stroke-width': width }));
    if (wallpaper === 'wood') {
      pattern.setAttribute('width', '768'); pattern.setAttribute('height', '192');
      pattern.append(element('rect', { x: 0, y: 0, width: 768, height: 96, fill: '#fff', opacity: 0.06 }));
      path('M 0 0 H 768 M 0 96 H 768 M 384 0 V 96', '#6f4829', 0.2, 1.4);
      for (const y of [18, 38, 62, 82, 116, 142, 168, 184]) {
        path(`M -40 ${y} C 90 ${y - 10} 210 ${y + 12} 360 ${y} S 650 ${y - 9} 808 ${y}`, '#805e3d', 0.11);
      }
      for (const [rx, ry] of [[36, 10], [55, 17]])
        pattern.append(element('ellipse', { cx: 182, cy: 137, rx, ry, fill: 'none', stroke: '#805e3d', 'stroke-opacity': 0.1 }));
    } else if (wallpaper === 'cutting-mat') {
      pattern.setAttribute('width', '384'); pattern.setAttribute('height', '384');
      const minor: string[] = [], major: string[] = [];
      for (let n = 0; n < 384; n += 24) {
        (n % 96 ? minor : major).push(`M ${n} 0 V 384 M 0 ${n} H 384`);
      }
      path(minor.join(' '), '#d3ead4', 0.2, 0.7);
      path(major.join(' '), '#d3ead4', 0.4, 1.2);
      path('M 180 192 H 204 M 192 180 V 204', '#e4f0dc', 0.5, 1.2);
      path('M 0 384 L 384 0', '#d3ead4', 0.08, 0.7);
    } else if (wallpaper === 'pink-notebook') {
      pattern.setAttribute('width', '576'); pattern.setAttribute('height', '168');
      path('M 0 0 H 576 M 0 56 H 576 M 0 112 H 576', '#ca91aa', 0.38);
      path('M 72 0 V 168', '#de8ca7', 0.42, 1.2);
      for (const [cx, cy] of [[16, 23], [140, 88], [350, 149], [491, 41]])
        pattern.append(element('circle', { cx, cy, r: 0.7, fill: '#c69aaa', opacity: 0.15 }));
    }
  }
  return {
    update(background: Settings['background'], camera: { x: number; y: number; zoom: number }) {
      if (background.wallpaper !== previous) { draw(background.wallpaper); previous = background.wallpaper; }
      const gray = Math.round(background.underlayBrightness * 255).toString(16).padStart(2, '0');
      underlay.setAttribute('fill', '#' + gray.repeat(3));
      surface.setAttribute('opacity', String(background.opacity));
      base.setAttribute('fill', background.color ?? wallpaperColors[background.wallpaper]);
      base.dataset.wallpaper = background.wallpaper;
      texture.setAttribute('fill', background.wallpaper === 'none' || background.wallpaper === 'charcoal' ? 'none' : 'url(#desk-surface-pattern)');
      pattern.setAttribute('patternTransform', `translate(${camera.x} ${camera.y}) scale(${camera.zoom})`);
      grid.setAttribute('visibility', (background.showGrid ?? background.wallpaper === 'none') ? 'visible' : 'hidden');
    },
  };
}
