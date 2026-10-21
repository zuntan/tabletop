import { rasterRenderedPart } from './part-raster';
import type { DeskObject, Operation } from './model';
import { cutoutTarget } from './logical-cutout';
import { isShapeType } from './shape-definitions';
import { iconButton } from './toolbar';

export function createCutoutControls(imageButton:HTMLElement,form:HTMLElement,selected:()=>DeskObject[],apply:(operations:Operation[])=>void,node:(id:string)=>SVGGElement|undefined,report:(message:string,error?:boolean)=>void){
 const button=document.createElement('button');button.id='cutout-create';button.type='button';iconButton(button,'▢','論理型抜き');imageButton.after(button);
 button.onclick=()=>{
  const objects=selected(),target=objects.find(cutoutTarget),mold=objects.find(o=>isShapeType(o.type));
  if(objects.length===2&&target&&mold)apply([{kind:'cutout',id:target.id,moldId:mold.id}]);
 };
 const status=document.createElement('div');status.id='cutout-status';status.style.cssText='display:flex;align-items:center;gap:8px;margin:10px 0;font-size:12px';
 const caption=document.createElement('span');
 const toggle=document.createElement('button');toggle.type='button';toggle.id='cutout-toggle';
 toggle.onclick=()=>{const target=selected()[0];if(target?.cutout)apply([{kind:'update',id:target.id,patch:{cutout:{...target.cutout,enabled:!target.cutout.enabled}}}]);};
 let copying=false;
 const copy=document.createElement('button');copy.type='button';copy.id='cutout-copy-image';copy.textContent='画像コピー';
 copy.title='切り抜いた中身を透過PNGとしてコピー';
 copy.onclick=()=>{
  const target=selected()[0],source=target&&node(target.id);
  if(copying||!target?.cutout?.enabled||!source)return;
  if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined'){report('このブラウザでは画像をクリップボードへ書き込めません',true);return;}
  copying=true;copy.disabled=true;
  const h=target.height-(target.type==='text'?0:34);
  const scale=Math.min(2,4090/Math.max(target.width,h),Math.sqrt(7_900_000/(target.width*h)));
  let dimensions='';
  const png=rasterRenderedPart(target,source,scale,true).then(result=>{
    dimensions=`${result.width}×${result.height}px`;
    const bytes=Uint8Array.from(atob(result.dataUrl.split(',')[1]),c=>c.charCodeAt(0));
    return new Blob([bytes],{type:'image/png'});
  });
  // Supply the promise during the button gesture; do not wait before requesting write.
  try{
    void navigator.clipboard.write([new ClipboardItem({'image/png':png})])
      .then(()=>report(`切り抜いた中身をPNGでコピーしました（${dimensions}）`))
      .catch(()=>report('画像をコピーできませんでした。ブラウザのクリップボード権限と画像の読み込みを確認してください',true))
      .finally(()=>{copying=false;update();});
  }catch{void png.catch(()=>{});copying=false;update();report('画像をクリップボードへ書き込めませんでした',true);}
 };
 status.append(caption,toggle,copy);form.after(status);
 function update(){const objects=selected();button.disabled=objects.length!==2||!objects.some(cutoutTarget)||!objects.some(o=>isShapeType(o.type));
  const object=objects.length===1?objects[0]:undefined;status.hidden=!object?.cutout;
  copy.hidden=!object?.cutout?.enabled;copy.disabled=copying||object?.type==='web';
  copy.title=object?.type==='web'?'Web資料のページ内容は画像コピーに未対応':'切り抜いた中身を透過PNGとしてコピー';
  if(object?.cutout){caption.textContent='型抜き設定あり';toggle.textContent=object.cutout.enabled?'ON':'OFF';toggle.setAttribute('aria-label','型抜き ON/OFF');toggle.setAttribute('aria-pressed',String(object.cutout.enabled));}
 }
 return{update};
}
