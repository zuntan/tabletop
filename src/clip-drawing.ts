import type { DeskObject } from './model';
import { element as svg } from './diagram-drawing';
import { clipAppearance } from './clip-appearance';
import binderSource from './assets/clips/binder.svg?raw';
import wireSource from './assets/clips/zem.svg?raw';

export function drawClip(group: SVGGElement, object: DeskObject, base?: DeskObject) {
  const appearance = clipAppearance(object, base), wire = object.clipStyle === 'wire';
  // These bundled assets are trusted. Prefix their classes and omit IDs to avoid
  // collisions with the application and other copies of the same illustration.
  const prefix = wire ? 'tabletop-wire-' : 'tabletop-binder-';
  const source = (wire ? wireSource : binderSource)
    .replace(/<style>([\s\S]*?)<\/style>/g, (_, css: string) => '<style>' + css.replace(/\.([a-z][a-z-]*)/g, (_, name) => '.' + prefix + name) + '</style>')
    .replace(/class="([^"]+)"/g, (_, names: string) => `class="${names.split(/\s+/).map(name => prefix + name).join(' ')}"`)
    .replace(/\s+id="[^"]*"/g, '');
  const image = document.importNode(new DOMParser().parseFromString(source, 'image/svg+xml').documentElement, true);
  image.setAttribute('x', String(-appearance.width / 2)); image.setAttribute('y', String(-appearance.height / 2));
  image.setAttribute('width', String(appearance.width)); image.setAttribute('height', String(appearance.height));
  image.setAttribute('style', `--clip-body:${object.fill}`);
  const drawing = svg('g', {
    transform: `translate(${object.width / 2} ${object.height / 2}) rotate(${appearance.angle})`,
    'pointer-events': 'none',
  });
  drawing.append(image);
  group.append(svg('rect', { width: object.width, height: object.height, fill: 'transparent', 'pointer-events': 'all' }), drawing);
  const title = svg('title'); title.textContent = `クリップ：${object.clipMembers?.length ?? 0}枚 · 間隔 ${object.clipOffset ?? 32}`; group.append(title);
}
