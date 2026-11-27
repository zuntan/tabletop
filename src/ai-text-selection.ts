import type { Desk } from './model';
import type { TextSelectionInput } from './text-selection-input';
import { textPositionMap } from './text-position-map';
import { randomUuid } from './portable-crypto';

export function createAiTextSelection(desk: Desk, node: (id: string) => SVGGElement | undefined,
  controls: { activate(id: string, host: HTMLElement, range?: Range): void; exit(): void }, canChange: () => boolean) {
  let generation = desk.documentGeneration;
  const tokens = new Map<string, { source: string; token: string }>();
  const stamp = () => ({ sessionId: desk.sessionId, revision: desk.revision });
  const target = (id: string) => {
    const object = desk.get(id);
    if (object.type !== 'text') throw new Error('Text selection supports Markdown text cards only');
    const host = node(id)?.querySelector<HTMLElement>('.markdown-text');
    if (!host?.isConnected) throw new Error('Card text is not rendered');
    if (generation !== desk.documentGeneration) { generation = desk.documentGeneration; tokens.clear(); }
    let entry = tokens.get(id);
    if (!entry || entry.source !== object.text) { entry = { source: object.text, token: randomUuid() }; tokens.set(id, entry); }
    return { host, map: textPositionMap(host), token: entry.token };
  };
  return {
    read(id: string) {
      const { map, token } = target(id);
      return { ...stamp(), id, text: map.text, length: map.length, atoms: map.atoms, offsetUnit: 'utf16', endExclusive: true, contentToken: token };
    },
    select(input: TextSelectionInput) {
      if (!canChange()) throw new Error('Human editing in progress. No text selection was changed.');
      if (input.action === 'clear') { controls.exit(); return { ...stamp(), active: false, id: null }; }
      const { host, map, token } = target(input.id!);
      let range: Range | undefined;
      if (input.action === 'range') {
        if (input.contentToken !== token) throw new Error('Text changed or document replaced; call desk_text_selection_read again');
        range = map.range(input.start!, input.end!);
      } else if (input.action === 'all') { range = document.createRange(); range.selectNodeContents(host); }
      // Validate everything before replacing the previous single-card selection.
      controls.activate(input.id!, host, range);
      return { ...stamp(), id: input.id, active: true, action: input.action, contentToken: token,
        ...(input.action === 'range' ? { start: input.start, end: input.end } : input.action === 'all' ? { start: 0, end: map.length } : {}) };
    },
  };
}
