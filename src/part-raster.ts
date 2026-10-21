import type { Desk, DeskObject } from './model';
import { cutoutTitle } from './logical-cutout';

/** Experimental single-card capture. No screen capture, edits, or selection changes. */
export async function rasterPointedCard(desk: Desk, node: (id: string) => SVGGElement | undefined, scale = 1) {
  const ids = desk.pointed();
  if (ids.length !== 1) throw new Error('Point at exactly one text card for this experiment');
  const object = desk.get(ids[0]);
  if (object.type !== 'text') throw new Error('This experiment supports text cards only');
  const source = node(object.id);
  if (!source?.isConnected) throw new Error('Card is not rendered');
  if (document.fonts.status !== 'loaded') throw new Error('Fonts are still loading');
  return { id: object.id, sessionId: desk.sessionId, revision: desk.revision, ...await rasterRenderedPart(object, source, scale) };
}

/** Freeze one rendered part. Web page bodies use a labelled placeholder; no iframe capture. */
export async function rasterRenderedPart(object: DeskObject, source: SVGGElement, scale = 1, contentOnly = false) {
  const started = performance.now();
  const clone = await cloneSvgForRaster(source);
  let bbox: {x:number;y:number;width:number;height:number} = source.getBBox();
  if(object.cutout){
    // getBBox includes unclipped source geometry; only capture the visible window.
    bbox={x:0,y:0,width:object.width,height:object.height};
    const badges=source.querySelector<SVGGElement>(':scope > [data-reactions]');
    if(badges){
      const b=badges.getBBox(),m=badges.transform.baseVal.consolidate()?.matrix??new DOMMatrix();
      const points=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(m));
      const x=Math.min(0,...points.map(p=>p.x)),y=Math.min(0,...points.map(p=>p.y));
      bbox={x,y,width:Math.max(object.width,...points.map(p=>p.x))-x,height:Math.max(object.height,...points.map(p=>p.y))-y};
    }
  }
  if(contentOnly){
    if(!object.cutout?.enabled)throw new Error('型抜きがONのパーツを選んでください');
    if(object.type==='web')throw new Error('Web資料のページ内容は画像コピーに対応していません');
    for(const child of [...clone.children])if(child.tagName!=='defs'&&!child.hasAttribute('data-cutout-content'))child.remove();
    bbox={x:0,y:cutoutTitle(object),width:object.width,height:object.height-cutoutTitle(object)};
  }
  const matrix=source.transform.baseVal.consolidate()?.matrix ?? new DOMMatrix();
  const corners=[[bbox.x,bbox.y],[bbox.x+bbox.width,bbox.y],[bbox.x,bbox.y+bbox.height],[bbox.x+bbox.width,bbox.y+bbox.height]]
    .map(([x,y])=>new DOMPoint(x,y).matrixTransform(matrix));
  const minX=Math.min(...corners.map(p=>p.x)), minY=Math.min(...corners.map(p=>p.y));
  const maxX=Math.max(...corners.map(p=>p.x)), maxY=Math.max(...corners.map(p=>p.y));
  const margin = contentOnly ? 0 : Math.max(2, object.strokeWidth / 2 + 1);
  const bounds = { x: minX-margin, y:minY-margin, width:maxX-minX+2*margin,height:maxY-minY+2*margin };
  const width = Math.ceil(bounds.width * scale), height = Math.ceil(bounds.height * scale);
  if (width > 4096 || height > 4096 || width * height > 8_000_000) throw new Error('Raster exceeds experimental size limit; use a smaller scale');
  const root = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  root.setAttribute('width', String(width)); root.setAttribute('height', String(height));
  root.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`);
  root.append(clone);
  // Data URL keeps foreignObject canvas origin-clean in Chromium (blob URLs do not).
  const xml = new XMLSerializer().serializeToString(root);
  const image = new Image();
  image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([image.decode(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Raster decode timed out')), 5000); })]);
  } finally { clearTimeout(timer); }
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  context.drawImage(image, 0, 0);
  const drawn = performance.now();
  const dataUrl = canvas.toDataURL('image/png');
  if (dataUrl.length > 7_000_000) throw new Error('PNG exceeds experimental transfer limit');
  return { width, height, scale, bounds,
    timingsMs: { raster: drawn - started, png: performance.now() - drawn, total: performance.now() - started },
    dataUrl, limitations: ['Single text card only; attachments and selection frames excluded', 'Current displayed stamp/reaction appearance; system fonts; approximate capture'] };
}

/** Freeze current styles and make image resources self-contained, without changing the desk. */
export async function cloneSvgForRaster<T extends SVGElement>(source:T):Promise<T>{
  const clone = source.cloneNode(true) as T;

  // Freeze HTML layout/style inside foreignObject; SVG artwork already uses attributes.
  const originals = source.querySelectorAll('*'), copies = clone.querySelectorAll('*');
  originals.forEach((element, index) => {
    const copy = copies[index];
    if (element instanceof HTMLElement && copy instanceof HTMLElement) {
      const style = getComputedStyle(element);
      for (const key of style) copy.style.setProperty(key, style.getPropertyValue(key));
    }
    if (element instanceof SVGTextElement) copy.setAttribute('font-family', getComputedStyle(element).fontFamily);
  });
  if(source.dataset.mermaidStatus === 'loading'||source.querySelector('[data-mermaid-status="loading"]')) throw new Error('Mermaidを描画中です。表示されてから再実行してください');
  // Embedded media must be self-contained before SVG is decoded as an image.
  for (const media of clone.querySelectorAll('image')) {
    const href=media.getAttribute('href') ?? media.getAttributeNS('http://www.w3.org/1999/xlink','href');
    if(href && !href.startsWith('data:')) {
      const response=await fetch(href,{signal:AbortSignal.timeout(5000),credentials:'omit'});
      if(!response.ok) throw new Error('画像をラスタ化できませんでした。画像の読み込みとアクセス許可を確認してください');
      const blob=await response.blob();
      if(blob.size>5_000_000)throw new Error('画像が大きすぎます');
      const url=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(blob);});
      media.setAttribute('href',url);
    }
  }
  for(const iframe of clone.querySelectorAll('iframe')) {
    const placeholder=document.createElement('div');placeholder.style.cssText='padding:18px;color:#64748b;font:14px sans-serif';
    placeholder.textContent='Web資料（ページ内容の画像化は対象外）';iframe.replaceWith(placeholder);
  }
  return clone;
}
