import { addPresetPalette } from './number-presets';
export function createCalloutPicker(select: HTMLSelectElement) {
  const labels: Record<string, string> = { none: 'なし', speech: '三角', thought: '考え事', leader: '引き出し線' };
  const { menu, choices, wrapper } = addPresetPalette(select, Object.keys(labels), '吹き出し');
  select.hidden = true; wrapper.classList.add('line-style-picker');
  for (const button of choices.querySelectorAll<HTMLButtonElement>('button')) {
    button.textContent = labels[button.dataset.value!]; button.setAttribute('aria-label', button.textContent);
  }
  return () => { menu.textContent = labels[select.value] ?? 'なし'; menu.title = '吹き出し：' + menu.textContent; };
}
