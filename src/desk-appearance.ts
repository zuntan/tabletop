import type {Settings} from './settings';

/** Plain surfaces share one renderer; only their colors differ. */
export const plainDeskColors=[
  {value:'plain-ivory',label:'無地（アイボリー）',color:'#fffaf0'},
  {value:'plain-blue',label:'無地（淡い青）',color:'#eff7ff'},
  {value:'plain-green',label:'無地（淡い緑）',color:'#f0faf3'},
  {value:'plain-pink',label:'無地（淡いピンク）',color:'#fff2f5'},
  {value:'plain-purple',label:'無地（淡い紫）',color:'#f7f2ff'},
] as const;
export function wallpaperChoice(background:Settings['background']){
  if(background.wallpaper!=='none')return background.wallpaper;
  return plainDeskColors.find(p=>p.color.toLowerCase()===background.color?.toLowerCase())?.value??'none';
}
export function wallpaperPatch(value:string):Partial<Settings['background']>{
  const plain=plainDeskColors.find(p=>p.value===value);
  return plain?{wallpaper:'none',color:plain.color}:{wallpaper:value as Settings['background']['wallpaper'],color:null};
}
function luminance(hex:string){
  const channels=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
  return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
}
export function titleForeground(background:string){
  const l=luminance(background),dark='#0f172a',light='#f8fafc';
  return (l+.05)/(luminance(dark)+.05)>=(luminance(light)+.05)/(l+.05)?dark:light;
}
export function applyTitleBackground(header:HTMLElement,color?:string|null){
  if(!color){header.style.removeProperty('background-color');header.style.removeProperty('color');delete header.dataset.customTitle;return;}
  header.style.backgroundColor=color;header.style.color=titleForeground(color);header.dataset.customTitle='true';
}
