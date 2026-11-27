type Point = { node: Node; offset: number };
export type TextAtom = { kind: 'image' | 'checkbox'; start: number; end: number; alt?: string; source?: string };
const blocks = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'PRE']);

/** Stable logical text: no soft-wrap positions, list bullets or Markdown source punctuation. */
export function textPositionMap(host: HTMLElement) {
  const chars: string[] = [], starts: Point[] = [], ends: Point[] = [], atoms: TextAtom[] = [];
  let space: { start: Point; end: Point } | undefined;
  let trailingBlockBreak = false;
  const point = (node: Node, end: boolean): Point => ({ node: node.parentNode!, offset: Array.prototype.indexOf.call(node.parentNode!.childNodes, node) + (end ? 1 : 0) });
  const append = (value: string, start: Point, end: Point) => {
    trailingBlockBreak = false;
    for (let i = 0; i < value.length; i++) { chars.push(value[i]); starts.push(start); ends.push(end); }
  };
  const flushSpace = () => {
    if (space && chars.length && !['\n', '\t'].includes(chars.at(-1)!)) append(' ', space.start, space.end);
    space = undefined;
  };
  const line = (element: Element, force = false, after = true) => {
    space = undefined;
    if (force || chars.length && chars.at(-1) !== '\n') {
      append('\n', force ? point(element, false) : ends.at(-1)!, point(element, after));
      trailingBlockBreak = !force;
    }
  };
  const visit = (node: Node, pre = false) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.textContent ?? '';
      // Markdown's renderer adds formatting newlines outside text blocks and after br.
      const structural = node.parentNode === host || ['UL', 'OL', 'TABLE', 'THEAD', 'TBODY', 'TR', 'BLOCKQUOTE'].includes(node.parentElement?.tagName ?? '');
      if (!pre && structural && /^\s*$/.test(value)) return;
      for (let i = 0; i < value.length; i++) {
        const start = { node, offset: i }, end = { node, offset: i + 1 };
        if (!pre && /[ \t\r\n\f]/.test(value[i])) { space = { start: space?.start ?? start, end }; continue; }
        flushSpace(); append(value[i], start, end);
      }
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.hasAttribute('data-markdown-image') || node.hasAttribute('data-markdown-task')) {
      flushSpace(); const start = chars.length;
      const image = node.hasAttribute('data-markdown-image');
      append(image ? '\ufffc' : (node as HTMLInputElement).checked ? '[x]' : '[ ]', point(node, false), point(node, true));
      atoms.push({ kind: image ? 'image' : 'checkbox', start, end: chars.length,
        ...(image ? { alt: node.dataset.imageAlt ?? '', source: node.dataset.markdownImage ?? '' } : {}) });
      return;
    }
    if (node.tagName === 'BR') { line(node, true); return; }
    if (node.tagName === 'TR') {
      line(node, false, false);
      const cells = [...node.children].filter(cell => ['TH', 'TD'].includes(cell.tagName));
      cells.forEach((cell, i) => {
        space = undefined;
        if (i) append('\t', point(cell, false), point(cell, false));
        for (const child of cell.childNodes) visit(child, pre);
      });
      line(node); return;
    }
    if (blocks.has(node.tagName)) line(node, false, false);
    for (const child of node.childNodes) visit(child, pre || node.tagName === 'PRE');
    if (blocks.has(node.tagName)) line(node);
  };
  for (const child of host.childNodes) visit(child);
  // A final block separator is not part of the logical text.
  if (trailingBlockBreak) { chars.pop(); starts.pop(); ends.pop(); }
  const text = chars.join('');
  const boundaries = new Set([...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map(segment => segment.index));
  boundaries.add(text.length);
  return {
    text, length: text.length, atoms,
    range(start: number, end: number) {
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > text.length || start >= end) throw new Error('Invalid text range');
      if (!boundaries.has(start) || !boundaries.has(end)) throw new Error('Range splits a Unicode grapheme');
      for (const atom of atoms) if (start > atom.start && start < atom.end || end > atom.start && end < atom.end) throw new Error('Range splits an atomic image or checkbox');
      const range = document.createRange();
      range.setStart(starts[start].node, starts[start].offset); range.setEnd(ends[end - 1].node, ends[end - 1].offset);
      return range;
    },
  };
}
