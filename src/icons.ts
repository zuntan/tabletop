import svg0 from './vendor/tabler/pointer.svg?raw';
import moon from './vendor/tabler/moon.svg?raw';
import sun from './vendor/tabler/sun.svg?raw';
import svg1 from './vendor/tabler/pointer-x.svg?raw';
import svg2 from './vendor/tabler/rectangle.svg?raw';
import svg3 from './vendor/tabler/square-rounded.svg?raw';
import svg4 from './vendor/tabler/circle.svg?raw';
import svg5 from './vendor/tabler/line.svg?raw';
import svg6 from './vendor/tabler/arrow-up-right.svg?raw';
import svg7 from './vendor/tabler/typography.svg?raw';
import svg8 from './vendor/tabler/photo.svg?raw';
import svg9 from './vendor/tabler/world.svg?raw';
import svg10 from './vendor/tabler/link.svg?raw';
import svg11 from './vendor/tabler/map-pin.svg?raw';
import svg12 from './vendor/tabler/clipboard.svg?raw';
import svg13 from './vendor/tabler/minus.svg?raw';
import svg14 from './vendor/tabler/plus.svg?raw';
import svg15 from './vendor/tabler/maximize.svg?raw';
import svg16 from './vendor/tabler/grid-dots.svg?raw';
import svg17 from './vendor/tabler/list-numbers.svg?raw';
import svg18 from './vendor/tabler/arrow-bar-to-up.svg?raw';
import svg19 from './vendor/tabler/arrow-bar-to-down.svg?raw';
import svg20 from './vendor/tabler/lock.svg?raw';
import svg21 from './vendor/tabler/eye.svg?raw';
import svg22 from './vendor/tabler/eye-off.svg?raw';
import svg23 from './vendor/tabler/x.svg?raw';
import svg24 from './vendor/tabler/arrow-back-up.svg?raw';
import svg25 from './vendor/tabler/arrow-forward-up.svg?raw';
import svg26 from './vendor/tabler/device-floppy.svg?raw';
import svg27 from './vendor/tabler/folder-open.svg?raw';
import svg28 from './vendor/tabler/pencil.svg?raw';

const sources = {
  moon, sun,
  'pointer': svg0,
  'pointer-x': svg1,
  'rectangle': svg2,
  'square-rounded': svg3,
  'circle': svg4,
  'line': svg5,
  'arrow-up-right': svg6,
  'typography': svg7,
  'photo': svg8,
  'world': svg9,
  'link': svg10,
  'map-pin': svg11,
  'clipboard': svg12,
  'minus': svg13,
  'plus': svg14,
  'maximize': svg15,
  'grid-dots': svg16,
  'list-numbers': svg17,
  'arrow-bar-to-up': svg18,
  'arrow-bar-to-down': svg19,
  'lock': svg20,
  'eye': svg21,
  'eye-off': svg22,
  'x': svg23,
  'arrow-back-up': svg24,
  'arrow-forward-up': svg25,
  'device-floppy': svg26,
  'folder-open': svg27,
  'pencil': svg28,
};
export type IconName = keyof typeof sources;

/** Trusted, vendored SVG only; never parse user or remote markup here. */
export function createIcon(name: IconName, size = 18): SVGSVGElement {
  const parsed = new DOMParser().parseFromString(sources[name], 'image/svg+xml');
  const icon = document.importNode(parsed.documentElement, true) as unknown as SVGSVGElement;
  for (const [key, value] of Object.entries({ width: size, height: size, 'stroke-width': 1, 'aria-hidden': 'true', focusable: 'false', 'data-icon': name })) {
    icon.setAttribute(key, String(value));
  }
  icon.classList.add('ui-icon');
  return icon;
}

