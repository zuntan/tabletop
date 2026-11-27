import { uiErrorMessage } from './i18n/errors';
import { DeskError } from './desk-errors';
import { uiText } from './i18n/dom';
import { resources } from './i18n/resources';
import type { DeskObject } from './model';
import { element } from './diagram-drawing';
import { IMAGE_TITLE_HEIGHT } from './image-geometry';

export const defaultWireloomSource = resources.ja.creation.wireloomSource;
type Rendered = { src: string; svg: string };
const cache = new Map<string, Promise<Rendered>>();
let library: Promise<typeof import('./vendor/wireloom/index.js')['default']> | undefined;
function loadLibrary() {
  return library ??= import('./vendor/wireloom/index.js').then(({default: wireloom})=>wireloom);
}
export function renderWireloom(source: string): Promise<Rendered> {
  const known = cache.get(source);
  if (known) { cache.delete(source); cache.set(source, known); return known; }
  const task = (async () => {
    if (!source.trim()) throw new DeskError('wireloomEmpty');
    if (source.length>100000) throw new Error('Wireloom source exceeds 100000 characters');
    const wireloom = await loadLibrary();
    const doc=wireloom.parse(source);
    const inspect=(node: unknown, largeHeader=false):void=>{
      if(!node||typeof node!=='object')return;
      const value=node as {kind?:string;attributes?:{kind:string;flag?:string;key?:string}[];children?:unknown[]};
      const large=largeHeader||(value.kind==='header'&&!!value.attributes?.some(a=>a.kind==='flag'&&a.flag==='large'));
      if(large&&value.kind==='text'&&value.attributes?.some(a=>a.kind==='pair'&&a.key==='width'))throw new Error('Wireloom text width is supported in body text, not large headers.');
      value.children?.forEach(child=>inspect(child,large));
    };
    inspect(doc.root);
    const { svg } = await wireloom.render('tabletop-wireloom', source);
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
export function drawWireloomCard(group: SVGGElement, object: DeskObject) {
  const image = element('image', { y: IMAGE_TITLE_HEIGHT, width: object.width,
    height: Math.max(0, object.height - IMAGE_TITLE_HEIGHT), preserveAspectRatio: 'xMidYMid meet', class: 'wireloom-image',
    'pointer-events': 'none' });
  const message = element('text', { x: 12, y: IMAGE_TITLE_HEIGHT + 24, fill: '#64748b', 'font-size': 14,
    'pointer-events': 'none', class: 'wireloom-status' });
  uiText(message,'creation:wireloomLoading'); group.dataset.wireloomStatus = 'loading'; group.append(image, message);
  void renderWireloom(object.wireloomSource ?? '').then(result => {
    image.setAttribute('href', result.src); message.remove(); group.dataset.wireloomStatus = 'ready';
  }).catch(error => {
    group.dataset.wireloomStatus = 'error';
    message.setAttribute('fill', '#b91c1c'); uiText(message,'creation:wireloomFailed');
    const title = element('title'); title.textContent = uiErrorMessage(error); group.append(title);
  });
}
