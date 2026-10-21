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
    const image = document.createElement('img'); image.src = `/props/${preset.filename}`; image.alt = ''; image.width = 72; image.height = 84;
    const name = document.createElement('span'); name.textContent = preset.name;
    button.title = preset.description; button.append(image, name); panel.append(button);
    button.onclick = async () => {
      button.disabled = true;
      try {
        const response = await fetch(`/props/${preset.filename}`);
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
