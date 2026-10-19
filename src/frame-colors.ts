import type { Settings } from './settings';

export const wallpaperFrameColors = {
  none: { selection: '#2563eb', pointing: '#15803d' },
  'wood-1': { selection: '#60a5fa', pointing: '#a3e635' },
  'wood-2': { selection: '#60a5fa', pointing: '#a3e635' },
  wood: { selection: '#1d4ed8', pointing: '#7c3aed' },
  'cutting-mat': { selection: '#facc15', pointing: '#e879f9' },
  'pink-notebook': { selection: '#1d4ed8', pointing: '#047857' },
  charcoal: { selection: '#60a5fa', pointing: '#a3e635' },
} as const;

export function frameColors(background: Settings['background']) {
  const preset = wallpaperFrameColors[background.wallpaper];
  return { selection: background.selectionColor ?? preset.selection, pointing: background.pointingColor ?? preset.pointing };
}
