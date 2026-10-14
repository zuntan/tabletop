import type { DeskObject } from './model';
import { isConnector } from './geometry';

const fields = ['x', 'y', 'x2', 'y2', 'width', 'height', 'fill', 'stroke', 'strokeWidth', 'fontSize', 'text', 'url'] as const;
const numeric = new Set(['x', 'y', 'x2', 'y2', 'width', 'height', 'strokeWidth', 'fontSize']);
export function syncProperties(form: HTMLFormElement, object: DeskObject) {
  const connector = isConnector(object);
  for (const name of fields) {
    const input = form.elements.namedItem(name) as HTMLInputElement;
    input.value = String(object[name] ?? '');
    const endpoint = name === 'x2' || name === 'y2';
    const size = name === 'width' || name === 'height';
    input.disabled = (object.type === 'label' && name !== 'x' && name !== 'y') ||
      (endpoint && !connector) || (size && connector) || (name === 'url' && !['web', 'link'].includes(object.type));
    if (endpoint || size) input.closest('label')!.hidden = endpoint ? !connector : connector;
  }
}
export function propertyPatch(form: HTMLFormElement, object: DeskObject): Partial<DeskObject> {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of new FormData(form)) {
    const parsed = numeric.has(key) ? Number(value) : String(value);
    if (parsed !== object[key as keyof DeskObject]) patch[key] = parsed;
  }
  if (isConnector(object)) {
    if ('x' in patch || 'y' in patch) patch.startBinding = null;
    if ('x2' in patch || 'y2' in patch) patch.endBinding = null;
  }
  return patch;
}
