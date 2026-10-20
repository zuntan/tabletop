import type { DeskObject } from './model';

export const IMAGE_TITLE_HEIGHT = 34;
type Size = { width: number; height: number };
type Entry = { src: string; status: 'loading' | 'ready' | 'error'; natural: Size | null };

/** Browser observations, not document edits. Rebuilt after load; never serialized. */
export class ImageGeometry {
  private entries = new Map<string, Entry>();

  observe(objects: DeskObject[], createImage: () => HTMLImageElement = () => new Image()) {
    const ids = new Set(objects.filter(o => o.type === 'image' || o.type === 'svg' || o.type === 'prop').map(o => o.id));
    for (const id of this.entries.keys()) if (!ids.has(id)) this.entries.delete(id);
    for (const object of objects) {
      if (!ids.has(object.id) || !object.src || object.height <= IMAGE_TITLE_HEIGHT) continue;
      if (this.entries.get(object.id)?.src === object.src) continue;
      const entry: Entry = { src: object.src, status: 'loading', natural: null };
      this.entries.set(object.id, entry);
      const image = createImage();
      image.src = object.src;
      void image.decode().then(() => {
        if (image.naturalWidth > 0 && image.naturalHeight > 0) {
          entry.natural = { width: image.naturalWidth, height: image.naturalHeight };
          entry.status = 'ready';
        } else entry.status = 'error';
      }).catch(() => { entry.status = 'error'; });
    }
  }

  describe(object: DeskObject) {
    if (object.type !== 'image' && object.type !== 'svg' && object.type !== 'prop') return {};
    const cardRect = { x: object.x, y: object.y, width: object.width, height: object.height };
    const viewportRect = object.height > IMAGE_TITLE_HEIGHT
      ? { x: object.x, y: object.y + IMAGE_TITLE_HEIGHT, width: object.width, height: object.height - IMAGE_TITLE_HEIGHT } : null;
    const cached = this.entries.get(object.id);
    const entry = cached?.src === object.src ? cached : undefined;
    const natural = entry?.natural ? { ...entry.natural } : null;
    // SVG may have only a viewBox, or its own internal fitting. Do not infer a pixel rectangle.
    const isSvg = object.type === 'svg' || object.type === 'prop' || object.src?.startsWith('data:image/svg+xml;');
    const isRemote = /^https?:/.test(object.src ?? '');
    const status = !viewportRect ? 'not-displayed' : isSvg ? 'svg-unresolved'
      : isRemote ? 'remote-unverified' : entry?.status ?? 'unobserved';
    let renderedRect = null;
    if (viewportRect && natural && status === 'ready') {
      const scale = Math.min(viewportRect.width / natural.width, viewportRect.height / natural.height);
      const width = natural.width * scale, height = natural.height * scale;
      renderedRect = { x: viewportRect.x + (viewportRect.width - width) / 2,
        y: viewportRect.y + (viewportRect.height - height) / 2, width, height };
    }
    return { imageGeometry: { status, coordinateSpace: 'world', fit: 'xMidYMid meet',
      naturalUnit: 'intrinsic-css-px', natural, cardRect, viewportRect, renderedRect } };
  }
}
