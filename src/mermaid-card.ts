import { uiErrorMessage } from './i18n/errors';
import { DeskError } from './desk-errors';
import { uiText } from './i18n/dom';
import { resources } from './i18n/resources';
import type { DeskObject } from './model';
import { element } from './diagram-drawing';
import { IMAGE_TITLE_HEIGHT } from './image-geometry';

export const defaultMermaidSource = resources.ja.creation.mermaidSource;
type Rendered = { src: string; svg: string };
const cache = new Map<string, Promise<Rendered>>();
let sequence = 0;
let library: Promise<typeof import('mermaid')['default']> | undefined;
function loadLibrary() {
  return library ??= import('mermaid').then(({ default: mermaid }) => {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default', htmlLabels: false,
      fontFamily: 'sans-serif', suppressErrorRendering: true, maxTextSize: 100000, maxEdges: 500,
      secure: ['secure', 'securityLevel', 'startOnLoad', 'suppressErrorRendering', 'maxTextSize', 'maxEdges',
        'htmlLabels', 'fontFamily', 'themeCSS', 'dompurifyConfig'],
      flowchart: { htmlLabels: false } });
    return mermaid;
  });
}
export function renderMermaid(source: string): Promise<Rendered> {
  const known = cache.get(source);
  if (known) { cache.delete(source); cache.set(source, known); return known; }
  const task = (async () => {
    if (!source.trim()) throw new Error('Enter Mermaid source.');
    // This first version is self-contained: external pictures are not part of the document.
    if (/\bimg\s*:|!\[[^\]]*\]\s*\(/i.test(source)) throw new DeskError('mermaidExternalImages');
    const mermaid = await loadLibrary();
    const { svg } = await mermaid.render(`tabletop-mermaid-${++sequence}`, source);
    const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
    if (document.querySelector('parsererror')) throw new DeskError('svgGenerationFailed');
    const root = document.documentElement;
    // SVG used as an image needs intrinsic dimensions rather than a percentage width.
    const viewBox = root.getAttribute('viewBox')?.split(/[ ,]+/).map(Number);
    if (viewBox?.length === 4 && viewBox.every(Number.isFinite)) {
      root.setAttribute('width', String(viewBox[2])); root.setAttribute('height', String(viewBox[3]));
    }
    const markup = new XMLSerializer().serializeToString(root);
    return { svg: markup, src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}` };
  })();
  cache.set(source, task);
  while (cache.size > 32) cache.delete(cache.keys().next().value!);
  return task;
}
/** Generated SVG is an image, never executable markup in the desk DOM. */
export function drawMermaidCard(group: SVGGElement, object: DeskObject) {
  const image = element('image', { y: IMAGE_TITLE_HEIGHT, width: object.width,
    height: Math.max(0, object.height - IMAGE_TITLE_HEIGHT), preserveAspectRatio: 'xMidYMid meet', class: 'mermaid-image',
    'pointer-events': 'none' });
  const message = element('text', { x: 12, y: IMAGE_TITLE_HEIGHT + 24, fill: '#64748b', 'font-size': 14,
    'pointer-events': 'none', class: 'mermaid-status' });
  uiText(message,'creation:mermaidLoading'); group.dataset.mermaidStatus = 'loading'; group.append(image, message);
  void renderMermaid(object.mermaidSource ?? '').then(result => {
    image.setAttribute('href', result.src); message.remove(); group.dataset.mermaidStatus = 'ready';
  }).catch(error => {
    group.dataset.mermaidStatus = 'error';
    message.setAttribute('fill', '#b91c1c'); uiText(message,'creation:mermaidFailed');
    const title = element('title'); title.textContent = uiErrorMessage(error); group.append(title);
  });
}
