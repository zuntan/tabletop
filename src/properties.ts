import type { DeskObject } from './model';
import { isConnector } from './geometry';
import { supportsFill, transparencyPercent, opacityFromPercent } from './fill-opacity';

const fields = ['x', 'y', 'x2', 'y2', 'width', 'height', 'fill', 'fillOpacity', 'stroke', 'strokeWidth', 'dash', 'startMarker', 'endMarker', 'calloutMode', 'fontSize', 'cornerRadius', 'padding', 'text', 'url'] as const;
const numeric = new Set(['x', 'y', 'x2', 'y2', 'width', 'height', 'strokeWidth', 'fontSize', 'cornerRadius', 'padding']);
export function syncProperties(form: HTMLFormElement, object: DeskObject) {
  const connector = isConnector(object);
  for (const name of fields) {
    const input = form.elements.namedItem(name) as HTMLInputElement;
    if (!input) continue;
    if (name === 'calloutMode') {
      input.disabled = object.type !== 'text'; input.closest('label')!.hidden = object.type !== 'text';
      input.value = object.callout ? object.callout.style ?? 'speech' : 'none'; continue;
    }
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
export function propertyValue(object: DeskObject, key: string): string {
  if (key === 'calloutMode') return object.callout ? object.callout.style ?? 'speech' : 'none';
  if (key === 'text' && object.type === 'label') return object.description ?? '';
  if (key === 'fillOpacity') return String(transparencyPercent(object.fillOpacity));
  if (key === 'padding') return String(object.padding ?? 6);
  if (key === 'dash') return object.dash ?? 'solid';
  if (key === 'startMarker' || key === 'endMarker') return object[key] ?? 'none';
  return String(object[key as keyof DeskObject] ?? '');
}

export function propertyFieldPatch(key: string, value: string, object: DeskObject): Partial<DeskObject> {
  if (!(fields as readonly string[]).includes(key)) throw new Error('Unknown property');
  if (value === propertyValue(object, key)) return {};
  if ((numeric.has(key) || key === 'fillOpacity') && (!value.trim() || !Number.isFinite(Number(value)))) throw new Error('有効な数値を入力してください');
  if (key === 'calloutMode') {
    if (object.type !== 'text' || !['none', 'speech', 'thought', 'leader'].includes(value)) throw new Error('Invalid callout mode');
    return { callout: value === 'none' ? null : { ...(object.callout ?? {
      x: object.x + object.width * .75, y: object.y + object.height + 80, binding: null }), style: value as 'speech' | 'thought' | 'leader' } };
  }
  const field = object.type === 'label' && key === 'text' ? 'description' : key;
  const parsed = key === 'fillOpacity' ? opacityFromPercent(value) : numeric.has(key) ? Number(value) : value;
  const patch: Record<string, unknown> = { [field]: parsed };
  if (isConnector(object)) {
    if ('x' in patch || 'y' in patch) patch.startBinding = null;
    if ('x2' in patch || 'y2' in patch) patch.endBinding = null;
  }
  return patch;
}
