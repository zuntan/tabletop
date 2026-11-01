import {z} from 'zod';
import type {Desk,Operation} from './model';
import {tightFrame,type PinFrame} from './pin-shape';
export const pinFitFields={
 seriesIds:z.array(z.string().min(1)).min(1).max(200),
 expectedRevision:z.number().int().nonnegative().optional(),
 actor:z.string().min(1).max(100).default('agent-01'),
};
/** UI and MCP share the same current/next-label measurement and frame rule. */
export function pinFitOperations(desk:Desk,seriesIds:string[],measure?:(text:string,fontSize:number)=>number):Operation[]{
 const series=desk.listSettings().series,objects=desk.snapshot();
 return [...new Set(seriesIds)].map(id=>{
  const current=series.find(s=>s.id===id);if(!current)throw new Error(`Unknown pin series: ${id}`);
  const texts=objects.filter(o=>o.type==='label'&&o.seriesId===id).map(o=>o.text);texts.push(current.nextText);
  const frame=tightFrame(current.fontSize,current.shape,texts,measure?t=>measure(t,current.fontSize):undefined);
  return{kind:'series_update',id,patch:frame};
 });
}
function browserPinMeasure(){
 if(document.fonts.status!=='loaded')throw new Error('フォントを読み込み中です。少し待って再実行してください');
 const context=document.createElement('canvas').getContext('2d');
 if(!context)throw new Error('ピン文字の計測を利用できません');
 return (text:string,size:number)=>{context.font=`${size}px sans-serif`;return context.measureText(text).width;};
}

export function browserPinFrame(fontSize:number,shape:PinFrame,texts:string[]){
 const measure=browserPinMeasure();return tightFrame(fontSize,shape,texts,text=>measure(text,fontSize));
}
export function browserPinFitOperations(desk:Desk,seriesIds:string[]){
 return pinFitOperations(desk,seriesIds,browserPinMeasure());
}
