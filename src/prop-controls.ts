import { publicAsset } from './runtime-mode';
import { propPresets } from './prop-presets';
import { stationeryButton } from './stationery-button';
export function createPropControls(container: HTMLElement, place: (preset: typeof propPresets[number], src: string) => void, report: (message: string, error?: boolean) => void) {
  const trigger = document.createElement('button'); trigger.type = 'button'; trigger.id = 'prop-open'; trigger.textContent = '小物 ▾';
  trigger.setAttribute('aria-label', '小物一覧');
  stationeryButton(trigger, 'prop', '小物一覧');
  const panel = document.createElement('div'); panel.id = 'prop-palette'; panel.popover = 'auto'; panel.setAttribute('aria-label', '小物一覧');
  trigger.popoverTargetElement = panel;
  for (const preset of propPresets) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.propPreset = preset.id;
    const image = document.createElement('img'); image.src = publicAsset(`props/${preset.filename}`); image.alt = ''; image.width = 60; image.height = 70;
    let preview:HTMLElement=image;
    if('responsive' in preset&&preset.responsive){
      // Lay out responsive SVG at its placement size before scaling the whole thumbnail.
      const holder=document.createElement('span');holder.className='prop-responsive-preview';
      const width=preset.width,height=preset.height-34,scale=Math.min(60/width,70/height);
      image.width=width;image.height=height;
      Object.assign(image.style,{width:`${width}px`,height:`${height}px`,transform:`translate(-50%,-50%) scale(${scale})`});
      holder.append(image);preview=holder;
    }
    const name = document.createElement('span'); name.className='prop-caption'; name.textContent = preset.name.replace(/^(ひと息の|まるっと|くるりの)/,'$1\n');
    button.title = preset.description; button.append(preview, name); panel.append(button);
    button.onclick = async () => {
      button.disabled = true;
      try {
        const response = await fetch(publicAsset(`props/${preset.filename}`));
        if (!response.ok) throw new Error('小物のSVGを読み込めませんでした');
        const source = await response.text();
        const bytes = new TextEncoder().encode(source);
        const src = `data:image/svg+xml;base64,${btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))}`;
        place(preset, src);
      } catch (error) { report(error instanceof Error ? error.message : String(error), true); }
      finally { button.disabled = false; }
    };
  }
  container.append(trigger, panel);
  const position = () => {
    const rect = trigger.getBoundingClientRect();
    panel.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - panel.offsetWidth - 8))}px`;
    panel.style.top = `${Math.max(8, Math.min(rect.bottom + 6, innerHeight - panel.offsetHeight - 8))}px`;
  };
  panel.addEventListener('toggle', () => { const open = panel.matches(':popover-open'); trigger.setAttribute('aria-expanded', String(open)); if (open) position(); });
  window.addEventListener('resize', position);
  container.addEventListener('keydown', event => { if (event.code === 'Space') event.stopPropagation(); });
}
