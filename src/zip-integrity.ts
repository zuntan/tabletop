// ZIP32 only: reject unsupported/encrypted archives and verify CRCs before use.
export function zipChecksums(bytes: Uint8Array): Map<string, { crc: number; size: number }> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  for (; end >= Math.max(0, bytes.length - 65557); end--) {
    if (view.getUint32(end, true) === 0x06054b50 && end + 22 + view.getUint16(end + 20, true) === bytes.length) break;
  }
  if (end < 0 || end < bytes.length - 65557) throw new Error('Invalid ZIP directory');
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) throw new Error('Multi-disk ZIP is unsupported');
  const count = view.getUint16(end + 10, true);
  const length = view.getUint32(end + 12, true);
  let offset = view.getUint32(end + 16, true);
  if (count > 2001 || count !== view.getUint16(end + 8, true) || offset + length !== end) throw new Error('Invalid ZIP directory');
  const entries = new Map<string, { crc: number; size: number }>();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) throw new Error('Invalid ZIP entry');
    const flags = view.getUint16(offset + 8, true), method = view.getUint16(offset + 10, true);
    const crc = view.getUint32(offset + 16, true), compressed = view.getUint32(offset + 20, true), size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const next = offset + 46 + nameLength + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
    const local = view.getUint32(offset + 42, true);
    if (next > end || flags & ~0x0808 || ![0, 8].includes(method) || view.getUint16(offset + 34, true)) throw new Error('Unsupported ZIP entry');
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    if (entries.has(name) || local + 30 > offset || view.getUint32(local, true) !== 0x04034b50) throw new Error('Invalid ZIP entry');
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    if (start + compressed > view.getUint32(end + 16, true)) throw new Error('Invalid ZIP data bounds');
    entries.set(name, { crc, size }); offset = next;
  }
  if (offset !== end) throw new Error('Invalid ZIP directory size');
  return entries;
}
const crcTable = new Uint32Array(256).map((_, i) => {
  let crc = i;
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});
export function verifyZipEntries(files: Record<string, Uint8Array>, checksums: Map<string, { crc: number; size: number }>) {
  if (Object.keys(files).length !== checksums.size) throw new Error('ZIP entry count mismatch');
  for (const [name, data] of Object.entries(files)) {
    let crc = 0xffffffff;
    for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
    const expected = checksums.get(name);
    if (!expected || data.length !== expected.size || ((crc ^ 0xffffffff) >>> 0) !== expected.crc) throw new Error('ZIP checksum mismatch');
  }
}
