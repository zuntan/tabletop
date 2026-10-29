import {z} from 'zod';

// Base64 plus metadata must fit the existing 20 MB browser bridge.
export const MAX_PDF_EXPORT_BYTES = 14 * 1024 * 1024;
export const pdfExportFields = {expectedRevision:z.number().int().nonnegative().optional()};
