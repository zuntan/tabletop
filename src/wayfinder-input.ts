import {z} from 'zod';
export const wayfinderStartFields={id:z.string().min(1).max(100).optional(),lineId:z.string().min(1).max(100).optional(),from:z.enum(['start','end']).optional(),mode:z.enum(['move','tour']).optional()};
export const wayfinderStartSchema=z.object(wayfinderStartFields).strict().superRefine((value,ctx)=>{
  if(!!value.id===!!value.lineId)ctx.addIssue({code:'custom',message:'Specify exactly one of id or lineId'});
  if(value.lineId&&!value.from)ctx.addIssue({code:'custom',message:'A line route requires from:start|end'});
  if(value.id&&value.from)ctx.addIssue({code:'custom',message:'from belongs to a line route, not a wayfinder'});
});
export type WayfinderStartInput=z.infer<typeof wayfinderStartSchema>;
