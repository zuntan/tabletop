import floorSource from '../wood_floor.svg?raw';
import type { Settings } from './settings';
import { element } from './diagram-drawing';

export const wallpaperUnderlayColor = '#808080';

export const wallpaperColors = {
  none: '#f8fafc', 'wood-1': '#8a735e', 'wood-2': '#88512f', wood: '#dfc49e', 'cutting-mat': '#315e50', 'pink-notebook': '#fff0f4', charcoal: '#252b33',
} as const;

/** Built-in SVG patterns and same-origin raster tiles; independent of UI theme and parts. */
export function createDeskBackground(canvas: SVGSVGElement) {
  const defs = canvas.querySelector('defs')!;
  const pattern = element('pattern', { id: 'desk-surface-pattern', patternUnits: 'userSpaceOnUse' });
  defs.append(pattern);
  const floorDocument = new DOMParser().parseFromString(floorSource, 'image/svg+xml');
  const grain = document.importNode(floorDocument.querySelector('#grain')!, true);
  grain.id = 'desk-floor-grain'; defs.append(grain);
  const floor = floorDocument.querySelector('#floor')!;

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
    if (wallpaper === 'wood-1' || wallpaper === 'wood-2') {
      // Keep supplied image pixels and aspect ratio; seams are accepted for this trial.
      pattern.setAttribute('width', '1672'); pattern.setAttribute('height', '941');
      pattern.append(element('image', { href: '/wallpapers/' + wallpaper + '.png', x: 0, y: 0, width: 1672, height: 941, preserveAspectRatio: 'none' }));
    } else if (wallpaper === 'wood') {
      pattern.setAttribute('width', floor.getAttribute('width')!);
      pattern.setAttribute('height', floor.getAttribute('height')!);
      for (const child of floor.children) {
        const node = document.importNode(child, true);
        if (node.getAttribute('fill') === 'url(#grain)') node.setAttribute('fill', 'url(#desk-floor-grain)');
        pattern.append(node);
      }
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
