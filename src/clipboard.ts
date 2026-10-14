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

export async function readClipboardFiles(): Promise<File[]> {
  if (!navigator.clipboard) throw new Error('クリップボードを読み取れません。Ctrl+Vで貼り付けてください');
  if (!navigator.clipboard.read) {
    const file = svgClipboardFile(await navigator.clipboard.readText());
    return file ? [file] : [];
  }
  const items = await navigator.clipboard.read();
  const files: File[] = [];
  for (const item of items) {
    const type = imageTypes.find(type => item.types.includes(type));
    if (type) {
      const blob = await item.getType(type);
      if (type === 'image/svg+xml') {
        const file = svgClipboardFile(await blob.text());
        if (file) files.push(file);
      } else files.push(new File([blob], 'クリップボード画像', { type }));
    } else if (item.types.includes('text/plain')) {
      const file = svgClipboardFile(await (await item.getType('text/plain')).text());
      if (file) files.push(file);
    }
  }
  return files;
}
