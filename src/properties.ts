import type { DeskObject } from './model';
import { isConnector } from './geometry';
import { supportsFill, transparencyPercent, opacityFromPercent } from './fill-opacity';

const fields = ['x', 'y', 'x2', 'y2', 'width', 'height', 'fill', 'fillOpacity', 'stroke', 'strokeWidth', 'dash', 'startMarker', 'endMarker', 'fontSize', 'cornerRadius', 'padding', 'text', 'url'] as const;
const numeric = new Set(['x', 'y', 'x2', 'y2', 'width', 'height', 'strokeWidth', 'fontSize', 'cornerRadius', 'padding']);
export function syncProperties(form: HTMLFormElement, object: DeskObject) {
  const connector = isConnector(object);
  for (const name of fields) {
    const input = form.elements.namedItem(name) as HTMLInputElement;
    if (!input) continue;
    if (name === 'dash' || name === 'startMarker' || name === 'endMarker') {
      input.disabled = !connector; input.closest('label')!.hidden = !connector;
      input.value = name === 'dash' ? object.dash ?? 'solid' : object[name] ?? 'none';
      continue;
    }
    if (name === 'padding' || name === 'cornerRadius') {
      const applicable = object.type === 'text' || name === 'cornerRadius' && object.type === 'roundedRect';
      input.disabled = !applicable; input.closest('label')!.hidden = !applicable;
      input.value = String(name === 'padding' ? object.padding ?? 6 : object.cornerRadius);
      continue;
    }
    if (name === 'text') input.closest('label')!.firstChild!.textContent = object.type === 'label' ? '説明文' : ['image', 'svg'].includes(object.type) ? 'タイトル' : 'テキスト';
    if (name === 'url') input.closest('label')!.firstChild!.textContent = ['image', 'svg'].includes(object.type) ? 'URL（任意）' : 'URL';
    input.value = name === 'fillOpacity' ? String(transparencyPercent(object.fillOpacity))
      : String(object.type === 'label' && name === 'text' ? object.description ?? '' : object[name] ?? '');
    const endpoint = name === 'x2' || name === 'y2';
    const size = name === 'width' || name === 'height';
    input.disabled = (object.type === 'label' && !['x', 'y', 'text'].includes(name)) ||
      (connector && (name === 'fontSize' || name === 'text')) ||
      (endpoint && !connector) || (size && connector) || (name === 'fillOpacity' && !supportsFill(object)) ||
      (name === 'url' && !['web', 'link', 'image', 'svg'].includes(object.type));
    if (endpoint || size) input.closest('label')!.hidden = endpoint ? !connector : connector;
    if (name === 'fillOpacity' || name === 'fontSize' || name === 'text') input.closest('label')!.hidden = connector;
  }
}
export function propertyPatch(form: HTMLFormElement, object: DeskObject): Partial<DeskObject> {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of new FormData(form)) {
    if (key === 'dash' && value === (object.dash ?? 'solid')) continue;
    if (key === 'padding' && Number(value) === (object.padding ?? 6)) continue;
    if (key === 'fillOpacity' && String(value) === String(transparencyPercent(object.fillOpacity))) continue;
    const parsed = key === 'fillOpacity' ? opacityFromPercent(String(value)) : numeric.has(key) ? Number(value) : String(value);
    const field = object.type === 'label' && key === 'text' ? 'description' : key;
    if (parsed !== (object[field as keyof DeskObject] ?? '')) patch[field] = parsed;
  }
  if (isConnector(object)) {
    if ('x' in patch || 'y' in patch) patch.startBinding = null;
    if ('x2' in patch || 'y2' in patch) patch.endBinding = null;
  }
  return patch;
}
