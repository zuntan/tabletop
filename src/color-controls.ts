import {isStyledLink} from './link-values';
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
export const recommendedSwatches = {
  fill: families.flatMap(family=>[family[0],family[1]]),
  stroke: ['#ffffff','#000000',...families.slice(1).flatMap(family=>[family[3],family[4]])],
  text: ['#ffffff','#000000',...families.slice(1).flatMap(family=>[family[4],family[5]])],
  sticker: ['#ffffff','#000000',...families.slice(1).flatMap(family=>[family[2],family[3]])],
};
const names = { fill: '塗り', stroke: '輪郭', text: '文字' };
function field(object: DeskObject, role: Role): 'fill' | 'stroke' | 'textColor' | null {
  if (object.type === 'label') return role === 'text' ? 'textColor' : role;
  if (role === 'fill') return object.type === 'clip' || object.type === 'wayfinder' || isShape(object) || (['text','file'].includes(object.type)||isStyledLink(object)) ? 'fill' : null;
  if (role === 'stroke') return isShape(object) || isConnector(object) || (['text','file'].includes(object.type)||isStyledLink(object)) ? 'stroke' : null;
  return isShape(object) || (['text','file'].includes(object.type)||isStyledLink(object)) || (object.type==='link'&&!object.deskPath&&object.linkDisplay!=='qr') ? 'textColor' : null;
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
export function createColorControls(container: HTMLElement, apply: (operations: Operation[]) => void, prefix = '', options: { roles?: Role[]; names?: Partial<Record<Role, string>>; allowTransparent?: boolean; popupContainer?:HTMLElement; paletteRole?: keyof typeof recommendedSwatches } = {}) {
  let objects: DeskObject[] = [];
  let selection = '';
  const compact = !!container.closest('nav');
  const captions = { ...names, ...options.names };
  const controls = (options.roles ?? ['fill', 'stroke', 'text'] as Role[]).map(role => {
    const row = document.createElement('div'); row.className = 'color-control';
    const label = document.createElement('span'); label.textContent = captions[role];
    const button = document.createElement('button'); button.type = 'button';
    button.className = 'color-trigger'; button.dataset.colorRole = `${prefix}${role}`;
    button.setAttribute('aria-label', `${captions[role]}の色`); button.setAttribute('aria-haspopup', 'dialog');
    const dot = document.createElement('span'); dot.className = 'color-dot';
    const value = document.createElement('span'); value.className = 'color-value'; button.append(dot, value);
    if (compact) {
      label.className = 'tool-caption'; label.textContent = role === 'stroke' ? '輪郭' : captions[role];
      button.classList.add('tool-button'); button.append(label); row.append(button);
    } else row.append(label, button);
    container.append(row);
    let ready = false;
    const pickr = Pickr.create({
      el: button, container:options.popupContainer??'body', useAsButton: true, theme: 'nano', appClass: `tabletop-palette palette-${prefix}${role}`,
      default: '#ffffff', defaultRepresentation: 'HEXA', swatches, comparison: false, closeOnScroll: true,
      components: { palette: false, preview: false, hue: false, opacity: false, interaction: {} },
      i18n: { 'ui:dialog': `${captions[role]}の色パレット`, 'btn:swatch': '色見本' },
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
      button.title = `${captions[role]}の色：${value.textContent}`;
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
      transparent.onclick = () => change('transparent'); if(options.allowTransparent !== false) popup.prepend(transparent);
      popup.querySelectorAll<HTMLButtonElement>('.pcr-swatches button').forEach((swatch, i) => {
        swatch.title = swatches[i]; swatch.setAttribute('aria-label', `${captions[role]} ${swatches[i]}`);
      });
      const paletteRole=options.paletteRole??role;
      const modeKey=`tabletop.palette.${paletteRole}.mode`;
      let mode='recommended';
      const switches=document.createElement('div');switches.className='palette-modes';switches.setAttribute('role','group');switches.setAttribute('aria-label','色パレットの種類');
      const updateMode=()=>{
        try{mode=localStorage.getItem(modeKey)==='all'?'all':'recommended';}catch{/* In-memory fallback. */}
        for(const tab of switches.querySelectorAll<HTMLButtonElement>('button'))tab.setAttribute('aria-pressed',String(tab.dataset.mode===mode));
        const colors=mode==='all'?[...swatches]:swatches.filter(color=>recommendedSwatches[paletteRole].includes(color));
        if(mode==='recommended'&&(paletteRole==='stroke'||paletteRole==='sticker')){
          // Seven columns: white starts row one; black starts row two.
          colors.splice(colors.indexOf('#000000'),1);colors.splice(7,0,'#000000');
        }
        popup.querySelectorAll<HTMLButtonElement>('.pcr-swatches button').forEach((swatch,i)=>{
          swatch.hidden=!colors.includes(swatches[i]);swatch.style.order=String(colors.indexOf(swatches[i]));
        });
        popup.dataset.paletteMode=mode;
        requestAnimationFrame(()=>{
          if(!pickr.isOpen())return;
          const rect=popup.getBoundingClientRect();
          const top=parseFloat(popup.style.top)||rect.top,left=parseFloat(popup.style.left)||rect.left;
          popup.style.top=`${top+Math.max(0,8-rect.top)-Math.max(0,rect.bottom-innerHeight+8)}px`;
          popup.style.left=`${left+Math.max(0,8-rect.left)-Math.max(0,rect.right-innerWidth+8)}px`;
        });
      };
      for(const [value,label] of [['recommended','おすすめ'],['all','全色']]){
        const tab=document.createElement('button');tab.type='button';tab.dataset.mode=value;tab.textContent=label;
        tab.onclick=()=>{mode=value;try{localStorage.setItem(modeKey,mode);}catch{/* In-memory fallback. */}updateMode();};switches.append(tab);
      }
      popup.prepend(switches);pickr.on('show',updateMode);updateMode();
      sync();
    }).on('swatchselect', (color: Pickr.HSVaColor) => change(color.toHEXA().toString().slice(0, 7).toLowerCase()))
      .on('show', () => button.setAttribute('aria-expanded', 'true'))
      .on('hide', () => button.setAttribute('aria-expanded', 'false'));
    return { sync, hide: () => pickr.hide(), destroy:()=>pickr.destroyAndRemove() };
  });
  return {
    update(selected: DeskObject[]) {
      const key = selected.map(o => o.id).join('|');
      if (key !== selection) controls.forEach(control => control.hide());
      objects = selected; selection = key;
      container.hidden = !objects.some(o => isShape(o) || isConnector(o) || o.type === 'text' || o.type === 'file' || o.type === 'label' || o.type === 'wayfinder');
      controls.forEach(control => control.sync());
    },
    destroy:()=>controls.forEach(control=>control.destroy()),
    isOpen: () => !!document.querySelector('.tabletop-palette.visible'),
  };
}
