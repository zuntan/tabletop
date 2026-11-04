import {z} from 'zod';

type WithoutDefault<T extends z.ZodType> = T extends z.ZodDefault<infer Inner> | z.ZodPrefault<infer Inner> ? Inner : T;

/** Omitted creation/patch fields must stay absent, rather than applying Zod 4 defaults. */
export function partialInputSchema<T extends Record<string,z.ZodType>>(schema:z.ZodObject<T>) {
  const shape = Object.fromEntries(Object.entries(schema.shape).map(([key,field])=>[
    key,z.optional(field instanceof z.ZodDefault || field instanceof z.ZodPrefault ? field.unwrap() : field),
  ])) as {[K in keyof T]:z.ZodOptional<WithoutDefault<T[K]>>};
  return z.object(shape).strict();
}
