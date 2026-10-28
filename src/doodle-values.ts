import {z} from 'zod';
import {colorSchema} from './settings';
export const doodleSchema=z.object({
 background:colorSchema.nullable().default(null),
 offset:z.object({x:z.number().finite(),y:z.number().finite()}).strict().default({x:0,y:0}),
 strokes:z.array(z.object({
  tool:z.enum(['pen','eraser']),color:colorSchema,width:z.number().finite().min(.1).max(1000),
  points:z.array(z.object({x:z.number().finite(),y:z.number().finite()}).strict()).min(1).max(10000),
 }).strict()).max(512),
}).strict().refine(value=>value.strokes.reduce((sum,s)=>sum+s.points.length,0)<=100000,'Doodle is too large');
export type Doodle=z.infer<typeof doodleSchema>;
export const emptyDoodle=():Doodle=>({background:null,offset:{x:0,y:0},strokes:[]});
const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const number=(n:number)=>String(Math.round(n*1000)/1000);
/** No curve fitting or shape recognition: preserve the person's actual trajectory. */
export function doodlePath(points:{x:number;y:number}[]){return points.map((p,i)=>`${i?'L':'M'}${number(p.x)} ${number(p.y)}`).join(' ') +(points.length===1?'l0.001 0':'');}
export function doodleSvg(value:Doodle,width:number,height:number){
 const w=Math.max(1,width),h=Math.max(1,height);let content='',defs='';
 value.strokes.forEach((s,i)=>{
  const path=`<path d="${doodlePath(s.points)}" fill="none" stroke="${s.tool==='eraser'?'black':escape(s.color)}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  if(s.tool==='pen')content+=path;
  else {const id='erase-'+i;defs+=`<mask id="${id}" maskUnits="userSpaceOnUse" x="${-value.offset.x}" y="${-value.offset.y}" width="${w}" height="${h}" style="mask-type:luminance"><rect x="${-value.offset.x}" y="${-value.offset.y}" width="${w}" height="${h}" fill="white"/>${path}</mask>`;content=`<g mask="url(#${id})">${content}</g>`;}
 });
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${value.background?`<rect width="${w}" height="${h}" fill="${escape(value.background)}"/>`:''}<g transform="translate(${value.offset.x} ${value.offset.y})">${content}</g></svg>`;
}
export function doodleSource(value:Doodle,width:number,height:number){
 const bytes=new TextEncoder().encode(doodleSvg(value,width,height));let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return 'data:image/svg+xml;base64,'+btoa(binary);
}
