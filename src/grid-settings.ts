import { z } from 'zod';

const coordinate = z.number().finite().min(-1_000_000).max(1_000_000);
export const gridSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  interval: z.number().finite().min(1).max(100_000).default(24),
  origin: z.object({ x: coordinate, y: coordinate }).strict().default({ x: 0, y: 0 }),
}).strict();
export type GridSettings = z.infer<typeof gridSettingsSchema>;
