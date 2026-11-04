import { t } from './i18n';
import { uiText, uiAttribute } from './i18n/dom';
import { addPresetPalette } from './number-presets';
export function createCalloutPicker(select: HTMLSelectElement) {
  const labels = { none: 'shell:none', speech: 'shell:speech', thought: 'shell:thought', leader: 'shell:leader' } as const;
  const { menu, choices, wrapper } = addPresetPalette(select, Object.keys(labels), t('shell:callout'));
  select.hidden = true; wrapper.classList.add('line-style-picker');
  for (const button of choices.querySelectorAll<HTMLButtonElement>('button')) {
    const key = labels[button.dataset.value as keyof typeof labels]; uiText(button, key); uiAttribute(button, 'aria-label', key);
  }
  return () => { uiText(menu, labels[select.value as keyof typeof labels] ?? 'shell:none'); menu.title = t('tools:calloutTitle', { name: menu.textContent }); };
}
