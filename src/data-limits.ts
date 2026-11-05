import { DeskError } from './desk-errors';
/** Decimal MB throughout the document and bridge protocols. */
export const MAX_ASSET_BYTES=10_000_000;
export const MAX_MANIFEST_BYTES=10_000_000;
export const MAX_DESK_BYTES=250_000_000;
export const MAX_OBJECTS=3000;
export const MAX_WS_BYTES=20_000_000;
export const TRANSFER_CHUNK_BYTES=1_000_000;
export const TRANSFER_IDLE_MS=30_000;
export function checkAssetBytes(size:number){if(size>MAX_ASSET_BYTES)throw new DeskError('assetSize');}
