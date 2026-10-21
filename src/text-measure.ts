import { z } from 'zod';
import type { Desk, DeskObject } from './model';

// Runtime bound avoids exposing a large maxItems grammar to local LLMs.
export const textMeasureFields = {
  ids: z.array(z.string().min(1).max(100)).min(1).refine(ids => ids.length <= 200, 'At most 200 IDs'),
};
export type TextMeasureBridge = (ids: string[]) => unknown;
export type TextMeasurement = {
  id: string;
  status: 'measured' | 'pending-fonts' | 'unsupported' | 'unavailable';
  layout?: 'markdown' | 'plain';
  frame: { width: number; height: number };
  overflow?: { x: boolean; y: boolean };
  requiredHeight?: number;
  canFitByHeight?: boolean;
  reason?: string;
};
export const supportsTextMeasure = (object: DeskObject) => ['text', 'rect', 'roundedRect'].includes(object.type);

/** Live browser layout only. No caches, document edits or selection changes. */
export function measureDeskText(desk: Desk, ids: string[], node: (id: string) => SVGGElement | undefined) {
  const objects = [...new Set(textMeasureFields.ids.parse(ids))].map(id => desk.get(id));
  const measurements = objects.map<TextMeasurement>(object => {
    const base = { id: object.id, frame: { width: object.width, height: object.height } };
    if(object.cutout) return {...base,status:'unsupported',reason:'型抜きは元レイアウトを変形表示します。通常の矩形収まり判定の対象外です'};
    if (!supportsTextMeasure(object)) return { ...base, status: 'unsupported' };
    const layout = object.type === 'text' ? 'markdown' : 'plain';
    if (document.fonts.status !== 'loaded') return { ...base, layout, status: 'pending-fonts' };
    const group = node(object.id);
    if (!group?.isConnected) return { ...base, layout, status: 'unavailable', reason: 'Object is not rendered' };
    if (layout === 'markdown') {
      const source = group.querySelector<HTMLElement>('.markdown-text');
      if (!source) return { ...base, layout, status: 'unavailable', reason: 'Markdown is not rendered' };
      const padding = object.padding ?? 6;
      if (object.width <= padding * 2) return { ...base, layout, status: 'unavailable', reason: 'Padding leaves no content width' };
      const clone = source.cloneNode(true) as HTMLElement;
      Object.assign(clone.style, { position: 'fixed', left: '-100000px', top: '0', visibility: 'hidden',
        pointerEvents: 'none', width: `${object.width}px`, height: 'auto', minHeight: '0', borderRadius: '0' });
      clone.setAttribute('aria-hidden', 'true'); document.body.append(clone);
      try {
        const requiredHeight = Math.ceil(clone.getBoundingClientRect().height);
        const x = clone.scrollWidth > clone.clientWidth + 1;
        return { ...base, layout, status: 'measured', overflow: { x, y: requiredHeight > object.height + 1 }, requiredHeight, canFitByHeight: !x };
      } finally { clone.remove(); }
    }
    const text = group.querySelector<SVGTextElement>('.shape-text');
    if (!object.text) return { ...base, layout, status: 'measured', overflow: { x: false, y: false }, requiredHeight: 0, canFitByHeight: true };
    if (!text) return { ...base, layout, status: 'unavailable', reason: 'Shape text is not rendered' };
    // Browser glyph hinting can change getBBox under a camera transform. Measure
    // the same SVG text at 1:1 in an isolated SVG, keeping world units stable.
    const probe = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    probe.setAttribute('width', String(object.width)); probe.setAttribute('height', String(object.height));
    Object.assign(probe.style, { position: 'fixed', left: '-100000px', top: '0', visibility: 'hidden', pointerEvents: 'none' });
    probe.setAttribute('aria-hidden', 'true');
    const clone = text.cloneNode(true) as SVGTextElement; probe.append(clone); document.body.append(probe);
    let box: DOMRect;
    try { box = clone.getBBox(); } finally { probe.remove(); }
    const x = box.x < -1 || box.x + box.width > object.width + 1;
    const y = box.y < -1 || box.y + box.height > object.height + 1;
    const requiredHeight = Math.ceil(2 * Math.max(object.height / 2 - box.y, box.y + box.height - object.height / 2, 0));
    return { ...base, layout, status: 'measured', overflow: { x, y }, requiredHeight, canFitByHeight: !x };
  });
  return { sessionId: desk.sessionId, revision: desk.revision, coordinateSpace: 'world', fitBoundary: 'rectangular-frame', tolerance: 1, measurements };
}
