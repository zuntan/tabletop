import type { Desk, DeskObject, Operation } from './model';
import { endpoints, isConnector } from './geometry';
import { randomUuid } from './portable-crypto';

export const partClipboardType = 'application/x-tabletop-copy';
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

/** External applications receive text only. Part identity never comes from plain text. */
export function partClipboardText(objects: DeskObject[]): string {
  return objects.flatMap(object => {
    if (object.type === 'image' || isConnector(object)) return [];
    if (object.type === 'svg') {
      const match = /^data:image\/svg\+xml;base64,([A-Za-z0-9+/=\s]+)$/.exec(object.src ?? '');
      if (!match) return []; // Copying a remote SVG must not fetch its URL.
      return [new TextDecoder().decode(Uint8Array.from(atob(match[1]), char => char.charCodeAt(0)))];
    }
    if (object.type === 'web' || object.type === 'link') return [[object.text, object.url].filter(Boolean).join('\n')];
    return [object.text];
  }).filter(text => text.length > 0).join('\n\n');
}

export function singleClipboardUrl(text: string): string | null {
  const source = text.trim();
  if (!/^https?:\/\/[^\s<>"'`\\]+$/i.test(source) || source.length > 4096) return null;
  try {
    const url = new URL(source);
    return url.hostname && !/[.,;!]$/.test(source) ? source : null;
  } catch { return null; }
}

/** A token refers only to the last snapshot in this tab. No serialized parts leave it. */
export class PartClipboard {
  private snapshot?: { token: string; objects: DeskObject[]; pasted: number };
  clear() { this.snapshot = undefined; }
  write(data: Pick<DataTransfer, 'setData' | 'getData'>, objects: DeskObject[]) {
    if (!objects.length) throw new Error('コピーするパーツを選択してください');
    if (objects.length > 200) throw new Error('一度にコピーできるパーツは200個までです');
    const text = partClipboardText(objects), token = randomUuid();
    data.setData('text/plain', text);
    // HTML provides the same-tab marker to the toolbar's async clipboard reader too.
    data.setData('text/html', `<pre data-tabletop-copy="${token}">${escapeHtml(text)}</pre>`);
    data.setData(partClipboardType, token);
    if (data.getData(partClipboardType) !== token) throw new Error('クリップボードへ書き込めませんでした');
    this.snapshot = { token, objects: structuredClone(objects), pasted: 0 };
    return { text, count: objects.length };
  }
  matches(token: string, html: string): boolean {
    if (!this.snapshot) return false;
    const marker = /data-tabletop-copy=["']([a-f0-9-]{36})["']/.exec(html)?.[1];
    return token === this.snapshot.token || marker === this.snapshot.token;
  }
  paste(desk: Desk): string[] {
    if (!this.snapshot) throw new Error('もう一度パーツをコピーしてください');
    const { objects, pasted } = this.snapshot;
    const ids = new Map(objects.map(object => [object.id, `${object.type}-${randomUuid()}`]));
    const step = desk.settingsSnapshot().grid.enabled ? desk.settingsSnapshot().grid.interval : 24;
    const offset = step * (pasted + 1);
    const operations: Operation[] = [];
    const junctions = new Map<string, string>();
    for (const object of objects) {
      const id = ids.get(object.id)!;
      if (object.type === 'label') {
        operations.push({ kind: 'label_add', id, seriesId: object.seriesId!, x: object.x + offset, y: object.y + offset, description: object.description });
        if (object.locked || object.reactions?.length) operations.push({ kind: 'update', id,
          patch: { locked: !!object.locked, reactions: [...object.reactions ?? []] } });
        if (object.attachment && ids.has(object.attachment.objectId)) operations.push({ kind: 'update', id,
          patch: { attachment: { ...object.attachment, objectId: ids.get(object.attachment.objectId)! } } });
      } else {
        const copy = { ...object, id, x: object.x + offset, y: object.y + offset };
        if (object.callout) {
          const binding = object.callout.binding, target = binding && ids.get(binding.objectId);
          copy.callout = { ...object.callout, x: object.callout.x + offset, y: object.callout.y + offset,
            binding: binding && target ? { ...binding, objectId: target } : null };
        }
        if (isConnector(object)) {
          const points = endpoints(object);
          Object.assign(copy, { x: points.start.x + offset, y: points.start.y + offset, x2: points.end.x + offset, y2: points.end.y + offset });
          for (const field of ['startJunction', 'endJunction'] as const) {
            const junction = object[field];
            if (junction) {
              if (!junctions.has(junction)) junctions.set(junction, 'junction-' + randomUuid());
              copy[field] = junctions.get(junction)!;
            }
          }
          for (const field of ['startBinding', 'endBinding'] as const) {
            const binding = object[field], target = binding && ids.get(binding.objectId);
            copy[field] = binding && target ? { ...binding, objectId: target } : null;
          }
        }
        operations.push({ kind: 'add', object: copy });
      }
    }
    if (operations.length > 200) throw new Error('ピンの属性を含む貼り付け処理が200件を超えます。選択を減らしてください');
    desk.execute({ actor: 'human', expectedRevision: desk.revision, snap: 'exact', operations });
    this.snapshot.pasted++;
    return [...ids.values()];
  }
}
