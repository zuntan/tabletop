import {MAX_DESK_BYTES} from './data-limits';
import {z} from 'zod';

// Binary chunk transport shares the 250MB export ceiling.
export const MAX_PDF_EXPORT_BYTES = MAX_DESK_BYTES;
export const pdfExportFields = {expectedRevision:z.number().int().nonnegative().optional()};
