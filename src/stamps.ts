import {appendStampDate} from './stamp-date';
import {outlineStampLabels} from './stamp-outline';
import {additionalStampArtwork} from './additional-stamp-artwork';
import type { DeskObject } from './model';
import { element as svg } from './diagram-drawing';
import { stampPattern, type Stamp } from './stamp-values';
let stampMaskSerial = 0;

/** Body-relative geometry. Decoration never changes object bounds or hit targets. */
export function stampLayout(width: number, height: number, compact: boolean, shape: string, angle = 0) {
  if (shape === 'award') {
    // Include both decorative rings and the footer date, even when the date is blank.
    // Keep a conservative text allowance: the date uses a system monospace font.
    const radians = angle * Math.PI / 180, cos = Math.cos(radians), sin = Math.sin(radians);
    const corners = [-106, 106].flatMap(x => [-54, 78].map(y => ({x:x*cos-y*sin,y:x*sin+y*cos})));
    const left = Math.min(...corners.map(p=>p.x)), right = Math.max(...corners.map(p=>p.x));
    const top = Math.min(...corners.map(p=>p.y)), bottom = Math.max(...corners.map(p=>p.y));
    const scale = Math.min(width * (compact ? .3 : .78) / (right-left), height * (compact ? .34 : .78) / (bottom-top));
    const margin = Math.min(4, width*.04, height*.04);
    return {width:210*scale,height:132*scale,
      x:compact?width-margin-right*scale:width/2-(left+right)/2*scale,
      y:compact?height-margin-bottom*scale:height/2-(top+bottom)/2*scale};
  }
  const ratio = shape === 'tall-square' ? 444 / 258 : shape === 'square' ? 2.1 : 1;
  const w = Math.min(width * (compact ? .3 : .78), height * (compact ? .34 : .78) * ratio);
  const h = w / ratio;
  return { width: w, height: h, x: compact ? width - w * .58 - Math.min(4, width * .04) : width / 2,
    y: compact ? height - h * .58 - Math.min(4, height * .04) : height / 2 };
}
export function stampArtwork(stamp: Stamp) {
  const additional=additionalStampArtwork(stamp.designId,stamp.text);if(additional)return additional;
  const pattern = stampPattern(stamp.designId), rectangular = pattern.shape === 'square';
  const g = svg('g', { fill: 'none', stroke: pattern.color, opacity: pattern.opacity,
    'stroke-width': 3, 'stroke-linejoin': 'round', 'pointer-events': 'none' });
  const text = (value: string, y: number, size: number, maxWidth: number, family = 'serif') => {
    const node = svg('text', { x: 0, y, fill: pattern.color, stroke: 'none', 'text-anchor': 'middle',
      'dominant-baseline': 'middle', 'font-size': size, 'font-weight': 800, 'font-family': family });
    node.textContent = value;
    node.setAttribute('data-stamp-fixed', 'true');
    node.setAttribute('data-stamp-max-width', String(maxWidth));
    g.append(node);
  };
  let footer=false;
  const footerDate=()=>{footer=true;};
  if (pattern.shape === 'care') {
    g.append(svg('rect', { x: -46, y: -46, width: 92, height: 92, rx: 4 }),
      svg('rect', { x: -41, y: -41, width: 82, height: 82, rx: 1, 'stroke-width': 1 }));
    if (stamp.designId.endsWith('_en')) { text('HANDLE', -32, 12, 70, 'sans-serif'); text('WITH CARE', -20, 11, 72, 'sans-serif'); }
    else text(pattern.title, -29, 17, 74);
    // Original silhouette based on the familiar handling-mark vocabulary, not a traced label.
    const mark = svg('g', { transform: 'translate(0 4) scale(.68)', fill: pattern.color, stroke: 'none' });
    const hand = 'M-40 -7Q-40 -12 -36 -12Q-32 -12 -32 -7V10Q-32 13 -29 16L-23 22Q-21 24 -19 22Q-17 20 -20 17L-26 11Q-29 8 -26 5Q-23 3 -20 6L-12 15Q-7 21 -7 28V35H-23V30L-36 18Q-40 14 -40 8Z';
    // Knock the hand outline out of the box; the gap reveals the actual card underneath.
    const maskId = `stamp-care-hands-${++stampMaskSerial}`;
    const defs = svg('defs', {}), mask = svg('mask', { id: maskId, maskUnits: 'userSpaceOnUse', x: -50, y: -40, width: 100, height: 90, 'mask-type': 'luminance' });
    mask.append(svg('rect', { x: -50, y: -40, width: 100, height: 90, fill: 'white' }),
      svg('path', { d: hand, fill: 'black', stroke: 'black', 'stroke-width': 3 }),
      svg('path', { d: hand, transform: 'scale(-1 1)', fill: 'black', stroke: 'black', 'stroke-width': 3 }));
    defs.append(mask); mark.append(defs,
      svg('path', { d: 'M0 -26 22 -13 0 0 -22 -13ZM-22 -10-2 3V23L-22 10ZM2 3 22 -10V10L2 23Z', mask: `url(#${maskId})` }));
    mark.append(svg('path', { d: hand }), svg('path', { d: hand, transform: 'scale(-1 1)' })); g.append(mark);

  } else if (stamp.designId === 'shirangana_ja' || stamp.designId === 'nandeyanen_ja') {
    const squareBadge = pattern.shape === 'squareBadge';
    if (squareBadge) g.append(svg('rect', { x: -46, y: -46, width: 92, height: 92, rx: 4 }), svg('rect', { x: -41, y: -41, width: 82, height: 82, rx: 1, 'stroke-width': 1 }));
    else g.append(svg('circle', { r: 46 }), svg('circle', { r: 41, 'stroke-width': 1 }));
    text(squareBadge ? '!' : '?', squareBadge?-3:-9, squareBadge ? 76 : 83, 65, 'serif');
    const symbol = g.lastElementChild!; symbol.setAttribute('opacity', '.48');
    // Chewy's reviewed 120% horizontal proportion is already in the outline.
    text(pattern.title, 3, squareBadge ? 17 : 15, squareBadge ? 78 : 77, 'sans-serif');
    const title = g.lastElementChild!; title.setAttribute('stroke', 'white'); title.setAttribute('stroke-width', '3'); title.setAttribute('paint-order', 'stroke fill');

  } else if (rectangular) {
    g.append(svg('rect', { x: -99, y: -44, width: 198, height: 88, rx: 5 }),
      svg('rect', { x: -94, y: -39, width: 188, height: 78, rx: 2, 'stroke-width': 1 }));
    text(pattern.title, -10, 33, 176, 'sans-serif');
    g.append(svg('path', { d: 'M -86 15 H 86', 'stroke-width': 1 }));
  } else {
    if (pattern.shape === 'flower') {
      // Separate, rounded pentagonal petals, rather than a sinusoidal scalloped ring.
      for (let i = 0; i < 10; i++) g.append(svg('path', {
        d: 'M -10 -32 Q -17 -42 -10 -48 Q 0 -55 10 -48 Q 17 -42 10 -32',
        transform: `rotate(${i * 36})`, 'stroke-width': 3.5,
      }));
      g.append(svg('circle', { r: 33, 'stroke-width': 3.5 }));
      const spiral = Array.from({ length: 121 }, (_, i) => {
        const angle = i / 120 * Math.PI * 4.1, r = 2 + i / 120 * 23;
        return `${i ? 'L' : 'M'}${Math.cos(angle) * r},${Math.sin(angle) * r}`;
      }).join(' ');
      g.append(svg('path', { d: spiral, 'stroke-width': 3.5, 'stroke-linecap': 'round' }));
      footerDate();
    } else if (pattern.shape === 'smile') {
      const points = Array.from({ length: 240 }, (_, i) => {
        const a = i * Math.PI / 120, r = 44 + 4 * Math.cos(a * 12);
        return `${i ? 'L' : 'M'}${Math.cos(a) * r},${Math.sin(a) * r}`;
      }).join(' ');
      g.append(svg('path', { d: points + ' Z' }), svg('circle', { r: 38, 'stroke-width': 1 }));
      g.append(svg('path', { d: 'M -22 -5 Q -15 -17 -8 -5 M 8 -5 Q 15 -17 22 -5 M -22 8 Q 0 35 22 8',
        'stroke-width': 4, 'stroke-linecap': 'round' }));
      footerDate();
    } else if (pattern.shape === 'words') {
      // Five broad cherry-blossom petals; each tip has a small inward notch.
      const polar = (radius: number, degrees: number) => {
        const a = degrees * Math.PI / 180; return `${Math.cos(a) * radius},${Math.sin(a) * radius}`;
      };
      let blossom = `M ${polar(37, -126)}`;
      for (let i = 0; i < 5; i++) {
        const a = -90 + i * 72;
        blossom += ` C ${polar(51, a - 32)} ${polar(54, a - 16)} ${polar(50, a - 5)}`;
        blossom += ` L ${polar(44, a)} L ${polar(50, a + 5)}`;
        blossom += ` C ${polar(54, a + 16)} ${polar(51, a + 32)} ${polar(37, a + 36)}`;
      }
      g.append(svg('path', { d: blossom + ' Z', 'stroke-width': 2.5 }));
      if(stamp.designId==='well_done_ja') {
        for(let i=0;i<5;i++) {
          const a=(-90+i*72)*Math.PI/180;
          g.append(svg('circle',{cx:52*Math.cos(a),cy:52*Math.sin(a),r:1.6,fill:pattern.color,stroke:'none','data-stamp-petal-dot':'true'}));
        }
      }
      const encouragement=stamp.designId==='keep_going_ja';
      // Japanese vertical columns read top-to-bottom, then right-to-left.
      const columns=encouragement?['がんばり','ましょう']:['たいへん','よくでき','ました'];
      const size=encouragement?15.5:14, step=encouragement?17.5:16, gap=encouragement?24:18;
      columns.forEach((column,index)=>{
        const chars=[...column],x=((columns.length-1)/2-index)*gap;
        chars.forEach((char,row)=>{
          const small='ぁぃぅぇぉゃゅょっゎ'.includes(char),offset=small?size*.14:0;
          const y=(row-(chars.length-1)/2)*step;
          text(char,y-offset,size,size,'sans-serif');
          g.lastElementChild!.setAttribute('x',String(x+offset));
        });
      });
      footerDate();
    } else {
      g.append(svg('circle', { r: 46 }), svg('circle', { r: 41, 'stroke-width': 1 }));
      // Match the single-character 「秘」 artwork (103 units at scale .46).
      text(pattern.title, -9, pattern.title.length === 1 ? 103 * .46 : 32, 74);
      g.append(svg('path', { d: 'M -37 20.5 H 37', 'stroke-width': 1 }));
    }
  }
  if (pattern.shape === 'care' || stamp.designId === 'shirangana_ja' || stamp.designId === 'nandeyanen_ja') {
    // Small, transparent interruptions in the new outlines suggest a lightly inked stamp.
    for (const border of g.querySelectorAll(':scope > circle, :scope > rect')) border.setAttribute('stroke-dasharray', '31 .7 19 .5 43 1');
  }
  outlineStampLabels(g);
  if(footer){
    const artwork=svg('g',{transform:'translate(0 -6) scale(.86)'});
    artwork.append(...Array.from(g.childNodes));g.append(artwork);
  }
  appendStampDate(g,stamp.designId,stamp.text);
  return g;
}
export function drawStamp(group: SVGGElement, object: DeskObject, compact: boolean) {
  group.querySelector('[data-stamp]')?.remove();
  if (!['text','file'].includes(object.type) || !object.stamp) return;
  const pattern = stampPattern(object.stamp.designId);
  const layout = stampLayout(object.width, object.height, compact,
    pattern.id==='excellent_en'?'award':['caution_en','danger_en','do_not_remove_ja'].includes(pattern.id)?'tall-square':pattern.shape, object.stamp.angle);
  const layer = svg('g', { 'data-stamp': object.stamp.designId, 'data-compact': String(compact),
    'pointer-events': 'none', 'aria-hidden': 'true',
    transform: `translate(${layout.x} ${layout.y}) rotate(${object.stamp.angle}) scale(${layout.width / (pattern.shape === 'square' ? 210 : 100)})` });
  layer.append(stampArtwork(object.stamp)); group.append(layer);
}
