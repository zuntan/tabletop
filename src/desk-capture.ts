import {z} from 'zod';
import type {Desk} from './model';
import {bounds} from './geometry';
export const captureFields={
 scale:z.number().finite().min(.1).max(3).default(1),
 ids:z.array(z.string().min(1)).min(1).max(200).optional(),
 bounds:z.object({x:z.number().finite(),y:z.number().finite(),width:z.number().finite().positive().max(1_000_000),height:z.number().finite().positive().max(1_000_000)}).strict().optional(),
 expectedRevision:z.number().int().nonnegative().optional(),
};
export type CaptureInput=z.infer<z.ZodObject<typeof captureFields>>;
export function captureBounds(desk:Desk,input:CaptureInput){
 if(Boolean(input.ids)===Boolean(input.bounds))throw new Error('Specify exactly one of ids or bounds');
 if(input.expectedRevision!==undefined&&input.expectedRevision!==desk.revision)throw new Error('Revision conflict; read the desk again');
 if(input.bounds)return{...input.bounds};
 const boxes=[...new Set(input.ids!)].map(id=>bounds(desk.get(id)));
 const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));
 return{x,y,width:Math.max(1,...boxes.map(b=>b.x+b.width-x)),height:Math.max(1,...boxes.map(b=>b.y+b.height-y))};
}
