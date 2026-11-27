import { z } from 'zod';

export const textSelectionReadFields = { id: z.string().min(1).max(100) };
export const textSelectionFields = {
  action: z.enum(['mode', 'all', 'range', 'clear']),
  id: z.string().min(1).max(100).optional(),
  start: z.number().int().nonnegative().optional(),
  end: z.number().int().nonnegative().optional(),
  contentToken: z.string().uuid().optional(),
};
export const textSelectionSchema = z.object(textSelectionFields).strict().superRefine((value, ctx) => {
  const invalid = (message: string) => ctx.addIssue({ code: 'custom', message });
  if (value.action !== 'clear' && !value.id) invalid('id is required');
  if (value.action === 'clear' && value.id !== undefined) invalid('clear does not accept id');
  if (value.action === 'range') {
    if (value.start === undefined || value.end === undefined || !value.contentToken) invalid('range requires start, end and contentToken from text_selection_read');
    else if (value.end <= value.start) invalid('range must be nonempty with start < end');
  } else if (value.start !== undefined || value.end !== undefined || value.contentToken !== undefined) invalid('Only range accepts start, end and contentToken');
});
export type TextSelectionInput = z.infer<typeof textSelectionSchema>;
