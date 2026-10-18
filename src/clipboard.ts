const imageTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];

/** Validate standalone SVG without inserting any nodes into the page. */
export function svgClipboardFile(text: string): File | null {
  const source = text.trim();
  if (!source || !/^(?:<\?xml\s|<svg[\s>])/i.test(source)) return null;
  if (new Blob([source]).size > 5_000_000) throw new Error('SVGは5MB以下にしてください');
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('DOCTYPEやENTITYを含むSVGには対応していません');
  const document = new DOMParser().parseFromString(source, 'image/svg+xml');
  if (document.querySelector('parsererror') || document.documentElement.localName !== 'svg' ||
    document.documentElement.namespaceURI !== 'http://www.w3.org/2000/svg') {
    throw new Error('有効なSVGコードをコピーしてください');
  }
  return new File([source], 'クリップボード.svg', { type: 'image/svg+xml' });
}

export type ClipboardContent = { text: string; html: string; token: string; files: File[] };

/** Read once so the toolbar sees the same clipboard item for text, files and markers. */
export async function readClipboardContent(): Promise<ClipboardContent> {
  if (!navigator.clipboard) throw new Error('クリップボードを読み取れません。Ctrl+Vで貼り付けてください');
  const result: ClipboardContent = { text: '', html: '', token: '', files: [] };
  if (!navigator.clipboard.read) {
    result.text = await navigator.clipboard.readText();
    return result;
  }
  const items = await navigator.clipboard.read();
  for (const item of items) {
    for (const [type, key] of [['text/plain', 'text'], ['text/html', 'html'], ['application/x-tabletop-copy', 'token']] as const) {
      if (item.types.includes(type)) result[key] += await (await item.getType(type)).text();
    }
    const type = imageTypes.find(type => item.types.includes(type));
    if (type) {
      const blob = await item.getType(type);
      if (type === 'image/svg+xml') {
        const file = svgClipboardFile(await blob.text());
        if (file) result.files.push(file);
      } else result.files.push(new File([blob], 'クリップボード画像', { type }));
    }
  }
  return result;
}
