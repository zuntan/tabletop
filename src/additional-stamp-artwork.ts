import {appendStampDate} from './stamp-date';
import {outlineStampLabels} from './stamp-outline';
// Original Tabletop SVG stamp artwork, based on the approved desk design sheet.
import {element} from './diagram-drawing';
const definitions="<mask id=\"bullet-holes\" maskUnits=\"userSpaceOnUse\" x=\"-250\" y=\"-120\" width=\"500\" height=\"240\"><rect x=\"-250\" y=\"-120\" width=\"500\" height=\"240\" fill=\"white\"/><path d=\"M0 -14 4 -7 11 -10 9 -3 16 1 8 5 10 13 2 9 -4 16 -6 7 -14 8 -9 0 -15 -6 -6 -6 -5 -15Z\" transform=\"translate(-195 -52)\" fill=\"black\"/><path d=\"M0 -14 4 -7 11 -10 9 -3 16 1 8 5 10 13 2 9 -4 16 -6 7 -14 8 -9 0 -15 -6 -6 -6 -5 -15Z\" transform=\"translate(193 28) rotate(25) scale(.8)\" fill=\"black\"/><path d=\"M-21 -5C-22 -16 -12 -23 -3 -22C7 -25 19 -18 21 -8C26 2 19 14 10 19C0 24 -12 21 -18 12C-23 8 -24 0 -21 -5Z\" transform=\"translate(-126 12) rotate(-12)\" fill=\"black\"/></mask><mask id=\"keyhole-outline\" maskUnits=\"userSpaceOnUse\" x=\"-130\" y=\"-130\" width=\"260\" height=\"260\"><rect x=\"-130\" y=\"-130\" width=\"260\" height=\"260\" fill=\"white\"/><path d=\"M0 -65C-28 -65 -48 -45 -48 -20C-48 -3 -39 11 -25 19L-40 73H40L25 19C39 11 48 -3 48 -20C48 -45 28 -65 0 -65Z\" fill=\"black\"/></mask>";
const artwork:Record<string,string>={
  "physical_checked_ja": "<g transform=\"scale(.46)\" stroke=\"#c93428\" fill=\"none\" opacity=\".9\" stroke-linejoin=\"round\"><g ><circle r=\"99\" stroke-width=\"6\"/><circle r=\"88\" stroke-width=\"2\"/><g transform=\"translate(-75 -55) scale(1.3)\" opacity=\".18\" fill=\"#c93428\" stroke=\"none\"><path d=\"M18 65V45Q18 38 25 38Q32 38 32 45V49H37V36Q37 29 44 29Q51 29 51 36V47H56V37Q56 30 63 30Q70 30 70 37V49H75V4Q75 -4 83 -4Q91 -4 91 4V58L105 49Q113 44 118 51Q122 57 115 64L91 88Q87 92 80 92H40Q32 92 28 84Z\"/></g><text x=\"0\" y=\"-30\" text-anchor=\"middle\" dominant-baseline=\"middle\" font-size=\"43\" fill=\"#c93428\" stroke=\"none\" font-weight=\"800\" font-family=\"serif\">現物</text><text x=\"0\" y=\"21\" text-anchor=\"middle\" dominant-baseline=\"middle\" font-size=\"43\" fill=\"#c93428\" stroke=\"none\" font-weight=\"800\" font-family=\"serif\">確認</text><path d=\"M-65 51H65\" stroke-width=\"1.5\"/></g></g>",
  "confidential_ja": "<g transform=\"scale(.46)\" stroke=\"#c93428\" fill=\"none\" opacity=\".9\" stroke-linejoin=\"round\"><g ><circle r=\"99\" stroke-width=\"6\"/><circle r=\"88\" stroke-width=\"2\"/><text x=\"0\" y=\"-12\" text-anchor=\"middle\" dominant-baseline=\"middle\" font-size=\"103\" fill=\"#c93428\" stroke=\"none\" font-weight=\"800\" font-family=\"serif\">秘</text><path d=\"M-65 51H65\" stroke-width=\"1.5\"/></g></g>",
  "confidential_en": "<g transform=\"scale(.46)\" stroke=\"#c93428\" fill=\"none\" opacity=\".9\" stroke-linejoin=\"round\"><g ><rect x=\"-222\" y=\"-86\" width=\"444\" height=\"172\" rx=\"7\" stroke-width=\"6\"/><rect x=\"-211\" y=\"-75\" width=\"422\" height=\"150\" rx=\"3\" stroke-width=\"2\"/><path d=\"M0 -65C-28 -65 -48 -45 -48 -20C-48 -3 -39 11 -25 19L-31 73H31L25 19C39 11 48 -3 48 -20C48 -45 28 -65 0 -65Z\" transform=\"scale(1.3)\" fill=\"none\" stroke=\"#c93428\" stroke-width=\"16\" stroke-linejoin=\"round\" opacity=\".22\"/><text x=\"0\" y=\"-12\" text-anchor=\"middle\" dominant-baseline=\"middle\" font-size=\"47\" fill=\"#c93428\" stroke=\"none\" font-weight=\"800\" font-family=\"sans-serif\" textLength=\"388\" lengthAdjust=\"spacingAndGlyphs\">CONFIDENTIAL</text><path d=\"M-192 51H192\" stroke-width=\"1.5\"/></g></g>",
  "unread_ja": "<g transform=\"scale(.46)\" stroke=\"#c93428\" fill=\"none\" opacity=\".9\" stroke-linejoin=\"round\"><g ><circle r=\"99\" stroke-width=\"6\"/><circle r=\"88\" stroke-width=\"2\"/><g opacity=\".18\" stroke-width=\"7\"><rect x=\"-62\" y=\"-45\" width=\"124\" height=\"78\" rx=\"5\"/><path d=\"M-60 -42L0 2 60 -42M-60 31L-20 -3M60 31L20 -3\"/></g><text x=\"0\" y=\"-12\" text-anchor=\"middle\" dominant-baseline=\"middle\" font-size=\"63\" fill=\"#c93428\" stroke=\"none\" font-weight=\"800\" font-family=\"serif\">未読</text><path d=\"M-65 51H65\" stroke-width=\"1.5\"/></g></g>",
  "unread_en": "<g transform=\"scale(.46)\" stroke=\"#c93428\" fill=\"none\" opacity=\".9\" stroke-linejoin=\"round\"><g><rect x=\"-99\" y=\"-99\" width=\"198\" height=\"198\" rx=\"7\" stroke-width=\"6\"/><rect x=\"-88\" y=\"-88\" width=\"176\" height=\"176\" rx=\"3\" stroke-width=\"2\"/><g stroke-width=\"3.5\"><rect x=\"-53\" y=\"-60\" width=\"106\" height=\"66\" rx=\"4\"/><path d=\"M-51 -57L0 -20 51 -57M-51 4L-17 -23M51 4L17 -23\"/></g><text x=\"0\" y=\"34\" text-anchor=\"middle\" dominant-baseline=\"middle\" font-size=\"35\" fill=\"#c93428\" stroke=\"none\" font-family=\"sans-serif\" font-weight=\"800\">UNREAD</text><path d=\"M-65 58H65\" stroke-width=\"1.5\"/></g></g>",
  "read_ja": "<g transform=\"scale(.46)\" stroke=\"#c93428\" fill=\"none\" opacity=\".9\" stroke-linejoin=\"round\"><g ><circle r=\"99\" stroke-width=\"6\"/><circle r=\"88\" stroke-width=\"2\"/><g opacity=\".18\" stroke-width=\"7\"><path d=\"M-62 -22L0 -67 62 -22V35H-62ZM-62 -22L0 14 62 -22M-62 35L-18 3M62 35L18 3\"/><path d=\"M-39 -9V-46H39V-9M-25 -31H25M-25 -18H15\"/></g><text x=\"0\" y=\"-12\" text-anchor=\"middle\" dominant-baseline=\"middle\" font-size=\"63\" fill=\"#c93428\" stroke=\"none\" font-weight=\"800\" font-family=\"serif\">既読</text><path d=\"M-65 51H65\" stroke-width=\"1.5\"/></g></g>",
  "read_en": "<g transform=\"scale(.46)\" stroke=\"#c93428\" fill=\"none\" opacity=\".9\" stroke-linejoin=\"round\"><g><rect x=\"-99\" y=\"-99\" width=\"198\" height=\"198\" rx=\"7\" stroke-width=\"6\"/><rect x=\"-88\" y=\"-88\" width=\"176\" height=\"176\" rx=\"3\" stroke-width=\"2\"/><g stroke-width=\"3.5\"><path d=\"M-53 -39L0 -78 53 -39V7H-53ZM-53 -39L0 -8 53 -39M-53 7L-15 -20M53 7L15 -20\"/><path d=\"M-34 -27V-59H34V-27\" fill=\"#fffcf6\"/><path d=\"M-22 -45H22M-22 -34H14\" stroke-width=\"2\"/></g><text x=\"0\" y=\"34\" text-anchor=\"middle\" dominant-baseline=\"middle\" font-size=\"35\" fill=\"#c93428\" stroke=\"none\" font-family=\"sans-serif\" font-weight=\"800\">READ</text><path d=\"M-65 58H65\" stroke-width=\"1.5\"/></g></g>",
  "copy_paste_only_ja": "<g transform=\"scale(.46)\" stroke=\"#c93428\" fill=\"none\" opacity=\".9\" stroke-linejoin=\"round\"><g><rect x=\"-99\" y=\"-99\" width=\"198\" height=\"198\" rx=\"7\" stroke-width=\"6\"/><rect x=\"-88\" y=\"-88\" width=\"176\" height=\"176\" rx=\"3\" stroke-width=\"2\"/><g fill=\"#c93428\" stroke=\"none\" font-weight=\"800\" font-family=\"sans-serif\"><text x=\"0\" y=\"-28\" text-anchor=\"middle\" dominant-baseline=\"middle\" font-size=\"43\">コピペ</text><text x=\"0\" y=\"22\" text-anchor=\"middle\" dominant-baseline=\"middle\" font-size=\"36\">しただけ</text></g><path d=\"M-65 58H65\" stroke-width=\"1.5\"/></g></g>",
  "copy_paste_only_en": "<g transform=\"scale(.46)\" stroke=\"#c93428\" fill=\"none\" opacity=\".9\" stroke-linejoin=\"round\"><g ><rect x=\"-222\" y=\"-86\" width=\"444\" height=\"172\" rx=\"7\" stroke-width=\"6\"/><rect x=\"-211\" y=\"-75\" width=\"422\" height=\"150\" rx=\"3\" stroke-width=\"2\"/><text x=\"0\" y=\"-30\" text-anchor=\"middle\" dominant-baseline=\"middle\" font-size=\"43\" fill=\"#c93428\" stroke=\"none\" font-weight=\"800\" font-family=\"sans-serif\">COPY &amp; PASTE</text><text x=\"0\" y=\"21\" text-anchor=\"middle\" dominant-baseline=\"middle\" font-size=\"43\" fill=\"#c93428\" stroke=\"none\" font-weight=\"800\" font-family=\"sans-serif\">ONLY</text><path d=\"M-192 51H192\" stroke-width=\"1.5\"/></g></g>",
  "wanted_ja": "<g transform=\"scale(.46)\" stroke=\"#c93428\" fill=\"none\" opacity=\".9\" stroke-linejoin=\"round\"><g ><rect x=\"-99\" y=\"-99\" width=\"198\" height=\"198\" rx=\"7\" stroke-width=\"6\"/><rect x=\"-88\" y=\"-88\" width=\"176\" height=\"176\" rx=\"3\" stroke-width=\"2\"/><text x=\"0\" y=\"-30\" text-anchor=\"middle\" dominant-baseline=\"middle\" font-size=\"43\" fill=\"#c93428\" stroke=\"none\" font-weight=\"800\" font-family=\"sans-serif\">欲しい</text><text x=\"0\" y=\"21\" text-anchor=\"middle\" dominant-baseline=\"middle\" font-size=\"45\" fill=\"#c93428\" stroke=\"none\" font-weight=\"800\" font-family=\"sans-serif\">…</text><path d=\"M-65 51H65\" stroke-width=\"1.5\"/></g></g>",
  "wanted_en": "<g transform=\"scale(.46)\" stroke=\"#c93428\" fill=\"none\" opacity=\".9\" stroke-linejoin=\"round\"><g mask=\"url(#bullet-holes)\"><rect x=\"-222\" y=\"-86\" width=\"444\" height=\"172\" rx=\"7\" stroke-width=\"6\"/><rect x=\"-211\" y=\"-75\" width=\"422\" height=\"150\" rx=\"3\" stroke-width=\"2\"/><g transform=\"translate(-126 12) rotate(-12) scale(1.4)\" opacity=\".2\"><polygon points=\"61,0 29.247837365454707,6.675628018689432 71.17654056429112,34.27681539028709 28.14593336884907,22.445632866914405 38.03287791338275,47.691720430549815 11.714860956174071,24.326159433365316 17.57915378254884,77.01930506236407 2.0206672185931327e-15,33 -13.573776971335175,59.47060264309124 -16.921465825584765,35.13778584819435 -49.255694346839945,61.764687114974365 -23.454944474040886,18.70469405576202 -54.95910094204756,26.466908086171053 -35.09740483854566,8.010753622427307 -79,9.674709713264091e-15 -26.32305362890924,-6.008065216820474 -54.95910094204757,-26.46690808617104 -25.800438921444975,-20.575163461338217 -49.25569434683996,-61.76468711497434 -16.92146582558477,-35.13778584819434 -13.57377697133519,-59.47060264309124 -5.510910596163089e-15,-30 17.579153782548754,-77.01930506236408 15.619814608232087,-32.43487924448709 38.032877913382734,-47.69172043054982 21.1094500266368,-16.83422465018581 71.17654056429113,-34.27681539028704 32.17262110200018,-7.343190820558383\" fill=\"#c93428\" stroke=\"none\"/><path d=\"M-18 -28L-59 -64 -88 -66 -112 -90M-35 2L-83 12 -107 4 -130 19M-13 35L-40 69 -35 85 -61 99M25 -29L62 -63 82 -57 106 -79M37 10L82 31 97 23 130 44\" stroke-width=\"5\"/></g><g transform=\"translate(160 39)\" opacity=\".2\"><path d=\"M0 -38 9 -13 30 -23 17 -3 40 9 15 14 23 35 2 22 -15 40 -15 16 -39 20 -23 0 -39 -17 -13 -13Z\" fill=\"#c93428\" stroke=\"none\"/></g><text x=\"0\" y=\"-12\" text-anchor=\"middle\" dominant-baseline=\"middle\" font-size=\"60\" fill=\"#c93428\" stroke=\"none\" font-weight=\"800\" font-family=\"sans-serif\">WANTED</text><path d=\"M-192 51H192\" stroke-width=\"1.5\"/></g></g>",
  "keep_secret_ja": "<g transform=\"scale(.46)\" stroke=\"#c93428\" fill=\"none\" opacity=\".9\" stroke-linejoin=\"round\"><g ><circle r=\"99\" stroke-width=\"6\"/><circle r=\"88\" stroke-width=\"2\"/><path d=\"M-59 -59L59 59M-59 59L59 -59\" stroke-width=\"16\" opacity=\".22\"/><text x=\"0\" y=\"-30\" text-anchor=\"middle\" dominant-baseline=\"middle\" font-size=\"43\" fill=\"#c93428\" stroke=\"none\" font-weight=\"800\" font-family=\"serif\">他言</text><text x=\"0\" y=\"21\" text-anchor=\"middle\" dominant-baseline=\"middle\" font-size=\"43\" fill=\"#c93428\" stroke=\"none\" font-weight=\"800\" font-family=\"serif\">無用</text><path d=\"M-65 51H65\" stroke-width=\"1.5\"/></g></g>",
  "fail_ja": "<g transform=\"scale(.46)\" stroke=\"#c93428\" fill=\"none\" opacity=\".9\" stroke-linejoin=\"round\"><g ><circle r=\"99\" stroke-width=\"6\"/><circle r=\"88\" stroke-width=\"2\"/><path d=\"M-59 -59L59 59M-59 59L59 -59\" stroke-width=\"16\" opacity=\".22\"/><text x=\"0\" y=\"-12\" text-anchor=\"middle\" dominant-baseline=\"middle\" font-size=\"53\" fill=\"#c93428\" stroke=\"none\" font-weight=\"800\" font-family=\"serif\">不合格</text><path d=\"M-65 51H65\" stroke-width=\"1.5\"/></g></g>",
  "fail_en": "<g transform=\"scale(.46)\" stroke=\"#c93428\" fill=\"none\" opacity=\".9\" stroke-linejoin=\"round\"><g ><circle r=\"99\" stroke-width=\"6\"/><circle r=\"88\" stroke-width=\"2\"/><path d=\"M-59 -59L59 59M-59 59L59 -59\" stroke-width=\"16\" opacity=\".22\"/><text x=\"0\" y=\"-12\" text-anchor=\"middle\" dominant-baseline=\"middle\" font-size=\"60\" fill=\"#c93428\" stroke=\"none\" font-weight=\"800\" font-family=\"sans-serif\">FAIL</text><path d=\"M-65 51H65\" stroke-width=\"1.5\"/></g></g>",
  "pass_ja": "<g transform=\"scale(.46)\" stroke=\"#c93428\" fill=\"none\" opacity=\".9\" stroke-linejoin=\"round\"><circle r=\"99\" stroke-width=\"6\"/><circle r=\"88\" stroke-width=\"2\"/><circle r=\"57\" stroke-width=\"16\" opacity=\".22\"/><text x=\"0\" y=\"-12\" text-anchor=\"middle\" dominant-baseline=\"middle\" font-size=\"53\" fill=\"#c93428\" stroke=\"none\" font-weight=\"800\" font-family=\"serif\">合格</text><path d=\"M-65 51H65\" stroke-width=\"1.5\"/></g>",
  "pass_en": "<g transform=\"scale(.46)\" stroke=\"#c93428\" fill=\"none\" opacity=\".9\" stroke-linejoin=\"round\"><circle r=\"99\" stroke-width=\"6\"/><circle r=\"88\" stroke-width=\"2\"/><circle r=\"57\" stroke-width=\"16\" opacity=\".22\"/><text x=\"0\" y=\"-12\" text-anchor=\"middle\" dominant-baseline=\"middle\" font-size=\"60\" fill=\"#c93428\" stroke=\"none\" font-weight=\"800\" font-family=\"sans-serif\">PASS</text><path d=\"M-65 51H65\" stroke-width=\"1.5\"/></g>"
};
// Original, geometric background drawings; no emoji or external icon fonts.
const approvalBackgrounds: Record<string,string> = {
 good_en: '<path d="M-65 -7H-41V62H-65ZM-36 58V-8L-13 -34Q-2 -46 -1 -67Q0 -78 10 -76Q25 -73 25 -53L21 -25H55Q75 -25 71 -6L57 50Q54 65 38 65H-15Z" fill="#c93428" stroke="none"/>',
 bad_en: '<path d="M0 -76C-43 -76 -52 -42 -37 -10L-26 20Q-19 43 0 43Q19 43 26 20L37 -10C52 -42 43 -76 0 -76Z" stroke-width="6"/><ellipse cx="-17" cy="-37" rx="7" ry="10" fill="#c93428" stroke="none"/><ellipse cx="17" cy="-37" rx="7" ry="10" fill="#c93428" stroke="none"/><ellipse cx="0" cy="20" rx="12" ry="20" fill="#c93428" stroke="none"/><path d="M-55 71Q-48 47 -39 27L-34 -8Q-33 -19 -25 -15Q-20 -13 -23 2L-23 29Q-26 47 -31 71M55 71Q48 47 39 27L34 -8Q33 -19 25 -15Q20 -13 23 2L23 29Q26 47 31 71" stroke-width="9" stroke-linecap="round"/>'
};
for(const [id,background] of Object.entries(approvalBackgrounds)) {
 const title=id==='good_en'?'GOOD':'BAD';
 artwork[id]=`<g transform="scale(.46)" stroke="#c93428" fill="none" opacity=".9" stroke-linejoin="round"><rect x="-99" y="-99" width="198" height="198" rx="7" stroke-width="6"/><rect x="-88" y="-88" width="176" height="176" rx="3" stroke-width="2"/><g opacity=".18" data-stamp-background="${id}">${background}</g><text x="0" y="-12" text-anchor="middle" dominant-baseline="middle" font-size="60" fill="#c93428" stroke="none" font-weight="800" font-family="sans-serif">${title}</text><path d="M-65 58H65" stroke-width="1.5"/></g>`;
}

// Original safety stamps, within a taller rectangular border.
const warningDesigns=['caution_en','danger_en','do_not_remove_ja'];
// Bold stripes occupy only the band between the two caution borders.
function cautionFrame() {
 const bands=[[-222,-129,222,-97],[-222,97,222,129],[-222,-97,-190,97],[190,-97,222,97]];
 const stripes:string[]=[];
 for(const [left,top,right,bottom] of bands) {
  for(let start=-480;start<=480;start+=96) {
   let points=[[start-top,top],[start+54-top,top],[start+54-bottom,bottom],[start-bottom,bottom]];
   for(const [bound,sign] of [[left,1],[right,-1]]) {
    const clipped:number[][]=[];
    points.forEach((a,i)=>{
     const b=points[(i+1)%points.length],insideA=(a[0]-bound)*sign>=0,insideB=(b[0]-bound)*sign>=0;
     if(insideA)clipped.push(a);
     if(insideA!==insideB)clipped.push([bound,a[1]+(b[1]-a[1])*(bound-a[0])/(b[0]-a[0])]);
    });
    points=clipped;
   }
   if(points.length>=3)stripes.push(`<polygon points="${points.map(p=>p.join(',')).join(' ')}"/>`);
  }
 }
 return `<rect x="-222" y="-129" width="444" height="258" rx="7" stroke-width="6"/>
 <g data-stamp-frame-stripes="true" fill="#c93428" stroke="none">${stripes.join('')}</g>
 <rect x="-190" y="-97" width="380" height="194" rx="2" stroke-width="6"/>`;
}
for(const id of warningDesigns) {
 const title=id==='do_not_remove_ja'?'門外不出':id==='caution_en'?'CAUTION':'DANGER';
 const frame=cautionFrame();
 const back=id==='danger_en'?'<rect x="-190" y="-97" width="380" height="140" fill="#c93428" stroke="none" data-stamp-solid-header="true"/>':'';
 artwork[id]=`<g transform="scale(.46)" stroke="#c93428" fill="none" opacity=".9" stroke-linejoin="round">${frame}${back}<text x="0" y="-18" text-anchor="middle" dominant-baseline="middle" font-size="60" fill="${id==='danger_en'?'white':'#c93428'}" stroke="none" font-weight="800" font-family="${id==='do_not_remove_ja'?'serif':'sans-serif'}">${title}</text><path d="M-176 43H176" stroke-width="1.5"/></g>`;
}
// The rings stop at the banner edges, leaving the card visible behind lettering.
const awardRings=[112,102].map((r,index)=>{
 const x=Math.sqrt(r*r-58*58);
 return `<path d="M${-x} -58A${r} ${r} 0 0 1 ${x} -58M${x} 58A${r} ${r} 0 0 1 ${-x} 58" stroke-width="${index===0?7:3}"/>`;
}).join('');
const awardStars=[-1,1].map(side=>[-1,0,1].map(index=>{
 const angle=(side<0?-90+index*25:90-index*25)*Math.PI/180;
 const x=83*Math.cos(angle),y=83*Math.sin(angle),size=index===0?12:9.5,rotation=side<0?index*25:-index*25;
 const points=Array.from({length:10},(_,i)=>{
  const a=(-90+rotation+i*36)*Math.PI/180,r=i%2===0?size:size*.446;
  return `${x+r*Math.cos(a)},${y+r*Math.sin(a)}`;
 }).join(' ');
 return `<polygon points="${points}" fill="#c93428" stroke="none" data-stamp-award-star="${side<0?'top':'bottom'}-${index+1}"/>`;
}).join('')).join('');
artwork.excellent_en=`<g transform="scale(.46)" stroke="#c93428" fill="none" opacity=".9" stroke-linejoin="round">${awardRings}${awardStars}<rect x="-222" y="-58" width="444" height="116" rx="14" stroke-width="7"/><rect x="-211" y="-47" width="422" height="94" rx="7" stroke-width="3"/><text x="0" y="0" text-anchor="middle" dominant-baseline="middle" font-size="86" fill="#c93428" stroke="none" font-family="sans-serif" font-weight="800">Excellent</text></g>`;
let serial=0;
export function additionalStampArtwork(designId:string,text:string){
 const source=artwork[designId];if(!source)return null;
 const rectangular=['do_not_remove_ja','confidential_en','copy_paste_only_en','wanted_en','caution_en','danger_en','excellent_en'].includes(designId);
 const round=['physical_checked_ja','confidential_ja','unread_ja','read_ja','keep_secret_ja','pass_ja','fail_ja','pass_en','fail_en'].includes(designId);
 const square=['unread_en','read_en','copy_paste_only_ja','wanted_ja','good_en','bad_en'].includes(designId);
 const lineY=round?20.5:square?26:designId==='copy_paste_only_en'?17.5:15;
 const layoutSource=!['caution_en','danger_en','do_not_remove_ja','excellent_en'].includes(designId)
  ?source.replace(/(M-?\d+ )(?:(?:43|51|58))(?=H)/g,`$1${lineY/.46}`):source;
 const prefix='additional-stamp-'+(++serial)+'-';
 const markup=('<svg xmlns="http://www.w3.org/2000/svg"><defs>'+definitions+'</defs>'+layoutSource+'</svg>').replace(/id="([^"]+)"/g,(_,id)=>'id="'+prefix+id+'"').replace(/url\\(#([^)]+)\\)/g,(_,id)=>'url(#'+prefix+id+')');
 const parsed=new DOMParser().parseFromString(markup,'image/svg+xml');
 const group=element('g',{'pointer-events':'none'});
 for(const child of Array.from(parsed.documentElement.children))group.append(document.importNode(child,true));
 for(const node of group.querySelectorAll<SVGTextElement>('text')) {
  const value=node.textContent??'';
  if(designId.endsWith('_en')) {
   // Use equal ink height within each shape; compress long words horizontally.
   node.setAttribute('font-size',String(rectangular?(designId==='copy_paste_only_en'?43:60):designId==='read_en'||designId==='unread_en'?35:60));
   node.setAttribute('data-stamp-max-width',String(rectangular?388:designId==='read_en'||designId==='unread_en'?144:150));
   if(designId==='caution_en'||designId==='danger_en')node.setAttribute('font-size','90');
   if(designId==='excellent_en'){node.setAttribute('font-size','86');node.setAttribute('data-stamp-width-scale','1');}
   if(designId==='caution_en'||designId==='danger_en')node.setAttribute('data-stamp-max-width','360');
   if(designId==='read_en'||designId==='unread_en')node.setAttribute('data-stamp-width-scale','1');
   if(designId==='copy_paste_only_en') {
    node.setAttribute('font-size','36');
    node.setAttribute('data-stamp-width-scale','1');
    if(value==='ONLY')node.setAttribute('y','14');
   }
  } else {
   if(designId==='do_not_remove_ja')node.setAttribute('font-size','90');
   // Match 「保留」 at size 32 after this artwork's .46 group scale.
   if(designId==='pass_ja'||designId==='fail_ja')node.setAttribute('font-size',String(32/.46));
   node.setAttribute('data-stamp-max-width',String(designId==='do_not_remove_ja'?360:rectangular?388:value.length>=3?152:144));
  }
 }
 outlineStampLabels(group,true);
 appendStampDate(group,designId,text,.9);
 return group;
}

