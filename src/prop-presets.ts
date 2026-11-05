import en from './i18n/en/props.json';
import ja from './i18n/ja/props.json';

/** Stable material metadata; placed copies never depend on catalog names or sources. */
export const propPresets = [
  { id: 'teacup', filename: 'teacup.svg', width: 210, height: 274 },
  { id: 'coffee', filename: 'coffee.svg', width: 210, height: 274 },
  { id: 'eraser', filename: 'eraser.svg', width: 240, height: 240 },
  { id: 'compass', filename: 'compass.svg', width: 210, height: 274 },
  { id: 'magnifier', filename: 'magnifier.svg', width: 240, height: 274 },
  { id: 'envelope', filename: 'envelope.svg', width: 240, height: 274 },
  { id: 'antique-key', filename: 'antique-key.svg', width: 210, height: 308 },
  { id: 'desk-bell', filename: 'desk-bell.svg', width: 240, height: 274 },
  { id: 'senpai-robot', filename: 'senpai-robot.svg', width: 240, height: 292 },
  { id: 'vacant-lot', filename: 'vacant-lot.svg', width: 480, height: 354, responsive: true },
  { id: 'vacant-lot-en', filename: 'vacant-lot-en.svg', width: 480, height: 354, responsive: true },
  { id: 'work-in-progress', filename: 'work-in-progress.svg', width: 480, height: 354, responsive: true },
  { id: 'work-in-progress-en', filename: 'work-in-progress-en.svg', width: 480, height: 354, responsive: true },
  { id: 'temporary-area', filename: 'temporary-area.svg', width: 480, height: 354, responsive: true },
  { id: 'temporary-area-en', filename: 'temporary-area-en.svg', width: 480, height: 354, responsive: true },
] as const;
export type PropPreset = typeof propPresets[number];

/** MCP uses English; the UI supplies its creation language explicitly. Never rewrites placed copies. */
export function localizedPropPreset(preset: PropPreset, language: 'en' | 'ja' = 'en') {
  const {name, description} = (language === 'ja' ? ja : en).presets[preset.id];
  return {...preset, name, description};
}
