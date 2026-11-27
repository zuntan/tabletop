const special = '[data-markdown-link],[data-markdown-image],[data-markdown-task]';

function nodeEdge(node: Node, end: boolean): [Node, number] {
  while (node.hasChildNodes()) node = (end ? node.lastChild : node.firstChild)!;
  if (node.nodeType === Node.TEXT_NODE) return [node, end ? node.textContent!.length : 0];
  const parent = node.parentNode!;
  return [parent, Array.prototype.indexOf.call(parent.childNodes, node) + (end ? 1 : 0)];
}

function fullySelected(range: Range, element: Element) {
  return range.isPointInRange(...nodeEdge(element, false)) && range.isPointInRange(...nodeEdge(element, true));
}

function matchingNode(host: Node, clone: Node, node: Node): Node {
  const path: number[] = [];
  while (node !== host) {
    const parent = node.parentNode!;
    path.unshift(Array.prototype.indexOf.call(parent.childNodes, node)); node = parent;
  }
  for (const index of path) clone = clone.childNodes[index];
  return clone;
}

const label = (value: string) => value.replace(/[\\\[\]]/g, '\\$&');
const destination = (value: string) => value.replace(/[\\()]/g, '\\$&');

/** Keep native plain text unless a complete link, image or task marker needs notation. */
export function copySelectedMarkdown(host: HTMLElement, range: Range, plainText: string): string {
  const originals = [...host.querySelectorAll<HTMLElement>(special)];
  const selected = originals.map(element => fullySelected(range, element));
  if (!selected.some(Boolean)) return plainText;

  // Work only on a clone. Range boundaries retain partially selected links as plain text.
  const clone = host.cloneNode(true) as HTMLElement;
  const elements = [...clone.querySelectorAll<HTMLElement>(special)];
  elements.forEach((element, index) => { if (selected[index]) element.dataset.copyNotation = ''; });
  const fragmentRange = document.createRange();
  fragmentRange.setStart(matchingNode(host, clone, range.startContainer), range.startOffset);
  fragmentRange.setEnd(matchingNode(host, clone, range.endContainer), range.endOffset);
  // A user can select a link's entire label with boundaries inside the anchor.
  // Include its wrapper too, otherwise cloneContents would discard the URL metadata.
  elements.forEach((element, index) => {
    if (!selected[index]) return;
    if (element.contains(fragmentRange.startContainer)) fragmentRange.setStartBefore(element);
    if (element.contains(fragmentRange.endContainer)) fragmentRange.setEndAfter(element);
  });
  clone.replaceChildren(fragmentRange.cloneContents());
  // Children first also preserves image links: [![alt](image-url)](link-url).
  for (const element of [...clone.querySelectorAll<HTMLElement>('[data-copy-notation]')].reverse()) {
    let text: string;
    if (element.hasAttribute('data-markdown-image')) {
      text = `![${label(element.dataset.imageAlt ?? '')}](${destination(element.dataset.markdownImage ?? '')})`;
    } else if (element instanceof HTMLInputElement) text = element.checked ? '[x]' : '[ ]';
    else text = `[${label(element.textContent ?? '')}](${destination(element.getAttribute('href') ?? '')})`;
    element.replaceWith(document.createTextNode(text));
  }
  clone.removeAttribute('data-text-selection'); clone.removeAttribute('tabindex'); clone.setAttribute('aria-hidden', 'true');
  // innerText retains rendered paragraphs, table tabs and code whitespace without adding
  // Markdown marks for headings/emphasis/tables. Offscreen layout never changes the live range.
  const width = getComputedStyle(host).width;
  Object.assign(clone.style, { position: 'fixed', left: '-100000px', top: '0', width, height: 'auto', overflow: 'visible', opacity: '0', pointerEvents: 'none' });
  host.parentElement!.append(clone);
  try { return clone.innerText; } finally { clone.remove(); }
}
