import Pickr from '@simonwep/pickr';
import '@simonwep/pickr/dist/themes/nano.min.css';
import type { DeskObject, Operation } from './model';
import { isConnector, isShape } from './geometry';

type Role = 'fill' | 'stroke' | 'text';
const families = [
  ['#ffffff', '#e5e7eb', '#9ca3af', '#6b7280', '#374151', '#000000'],
  ['#fee2e2', '#fca5a5', '#f87171', '#ef4444', '#b91c1c', '#7f1d1d'],
  ['#ffedd5', '#fdba74', '#fb923c', '#f97316', '#c2410c', '#7c2d12'],
  ['#fef9c3', '#fde047', '#facc15', '#eab308', '#a16207', '#713f12'],
  ['#dcfce7', '#86efac', '#4ade80', '#22c55e', '#15803d', '#14532d'],
  ['#dbeafe', '#93c5fd', '#60a5fa', '#3b82f6', '#1d4ed8', '#1e3a8a'],
  ['#f3e8ff', '#d8b4fe', '#c084fc', '#a855f7', '#7e22ce', '#581c87'],
];
export const swatches = Array.from({ length: 6 }, (_, shade) => families.map(family => family[shade])).flat();
const names = { fill: '塗り', stroke: '輪郭・矢印', text: '文字' };
function field(object: DeskObject, role: Role): 'fill' | 'stroke' | 'textColor' | null {
  if (object.type === 'label') return role === 'text' ? 'textColor' : role;
  if (role === 'fill') return isShape(object) || object.type === 'text' ? 'fill' : null;
  if (role === 'stroke') return isShape(object) || isConnector(object) || object.type === 'text' ? 'stroke' : null;
  return isShape(object) || object.type === 'text' ? 'textColor' : null;
}
export function colorOperations(objects: DeskObject[], role: Role, color: string): Operation[] {
  const seen = new Set<string>();
  return objects.flatMap<Operation>(object => {
    const key = field(object, role);
    if (object.type === 'label' && object.seriesId && key) {
      if (seen.has(object.seriesId)) return [];
      seen.add(object.seriesId);
      return [{ kind: 'series_update', id: object.seriesId, patch: { [key]: color } }];
    }
    return key ? [{ kind: 'update' as const, id: object.id, patch: { [key]: color } }] : [];
  });
}

/** A thin adapter around Pickr's existing swatch picker, shared by all object types. */
export function createColorControls(container: HTMLElement, apply: (operations: Operation[]) => void, prefix = '') {
  let objects: DeskObject[] = [];
  let selection = '';
  const controls = (['fill', 'stroke', 'text'] as const).map(role => {
    const row = document.createElement('div'); row.className = 'color-control';
    const label = document.createElement('span'); label.textContent = names[role];
    const button = document.createElement('button'); button.type = 'button';
    button.className = 'color-trigger'; button.dataset.colorRole = `${prefix}${role}`;
    button.setAttribute('aria-label', `${names[role]}の色`); button.setAttribute('aria-haspopup', 'dialog');
    const dot = document.createElement('span'); dot.className = 'color-dot';
    const value = document.createElement('span'); button.append(dot, value); row.append(label, button); container.append(row);
    let ready = false;
    const pickr = Pickr.create({
      el: button, useAsButton: true, theme: 'nano', appClass: `tabletop-palette palette-${prefix}${role}`,
      default: '#ffffff', defaultRepresentation: 'HEXA', swatches, comparison: false, closeOnScroll: true,
      components: { palette: false, preview: false, hue: false, opacity: false, interaction: {} },
      i18n: { 'ui:dialog': `${names[role]}の色パレット`, 'btn:swatch': '色見本' },
    });
    const change = (color: string) => { apply(colorOperations(objects, role, color)); pickr.hide(); button.focus(); };
    const sync = () => {
      const applicable = objects.flatMap(object => { const key = field(object, role); return key ? [object[key]] : []; });
      const unique = [...new Set(applicable)];
      const color = unique.length === 1 ? unique[0] : null;
      row.hidden = !applicable.length; button.disabled = !applicable.length;
      button.dataset.color = color ?? 'mixed';
      dot.style.backgroundColor = color ?? 'transparent';
      dot.classList.toggle('transparent', color === 'transparent'); dot.classList.toggle('mixed', color === null);
      value.textContent = color === 'transparent' ? '透明' : color ?? '複数の色';
      if (ready) {
        pickr.setColor(color === 'transparent' || !color ? null : color, true);
        const popup = document.querySelector<HTMLElement>(`.palette-${prefix}${role}`)!;
        popup.querySelector<HTMLButtonElement>('.transparent-choice')?.setAttribute('aria-pressed', String(color === 'transparent'));
        popup.querySelectorAll<HTMLButtonElement>('.pcr-swatches button').forEach((swatch, i) => {
          swatch.setAttribute('aria-pressed', String(color?.toLowerCase() === swatches[i]));
        });
      }
    };
    pickr.on('init', () => {
      ready = true;
      const popup = document.querySelector<HTMLElement>(`.palette-${prefix}${role}`)!;
      const transparent = document.createElement('button'); transparent.type = 'button';
      transparent.className = 'transparent-choice'; transparent.textContent = '透明（なし）';
      transparent.onclick = () => change('transparent'); popup.prepend(transparent);
      popup.querySelectorAll<HTMLButtonElement>('.pcr-swatches button').forEach((swatch, i) => {
        swatch.title = swatches[i]; swatch.setAttribute('aria-label', `${names[role]} ${swatches[i]}`);
      });
      sync();
    }).on('swatchselect', (color: Pickr.HSVaColor) => change(color.toHEXA().toString().slice(0, 7).toLowerCase()))
      .on('show', () => button.setAttribute('aria-expanded', 'true'))
      .on('hide', () => button.setAttribute('aria-expanded', 'false'));
    return { sync, hide: () => pickr.hide() };
  });
  return {
    update(selected: DeskObject[]) {
      const key = selected.map(o => o.id).join('|');
      if (key !== selection) controls.forEach(control => control.hide());
      objects = selected; selection = key;
      container.hidden = !objects.some(o => isShape(o) || isConnector(o) || o.type === 'text' || o.type === 'label');
      controls.forEach(control => control.sync());
    },
    isOpen: () => !!document.querySelector('.tabletop-palette.visible'),
  };
}
