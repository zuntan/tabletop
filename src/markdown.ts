import MarkdownIt from 'markdown-it';
import type { DeskObject } from './model';

const markdown = new MarkdownIt({ html: false, breaks: true, linkify: true, typographer: false })
  .disable('image');
markdown.linkify.set({ fuzzyLink: false, fuzzyEmail: false });
markdown.core.ruler.after('inline', 'task_lists', state => {
  let taskIndex = 0;
  const lines = state.src.split('\n');
  for (let i = 2; i < state.tokens.length; i++) {
    const inline = state.tokens[i];
    if (inline.type !== 'inline' || state.tokens[i - 1].type !== 'paragraph_open' ||
        state.tokens[i - 2].type !== 'list_item_open') continue;
    const first = inline.children?.[0];
    const marker = first?.type === 'text' && /^\[([ xX])\](?:\s+|$)/.exec(first.content);
    if (!marker || !first || !inline.children) continue;
    const taskLine = inline.map?.[0];
    if (taskLine === undefined || !/(?<!\\)\[([ xX])\](?=\s|$)/.test(lines[taskLine])) continue;
    first.content = first.content.slice(marker[0].length);
    const checkbox = new state.Token('html_inline', '', 0);
    inline.meta = { taskLine };
    checkbox.content = `<input class="task-list-checkbox" data-markdown-task="${taskIndex++}" type="checkbox" disabled${marker[1] !== ' ' ? ' checked' : ''}> `;
    inline.children.unshift(checkbox);
    state.tokens[i - 2].attrJoin('class', 'task-list-item');
  }
});
markdown.validateLink = href => {
  try { return ['http:', 'https:'].includes(new URL(href).protocol); }
  catch { return false; }
};
markdown.renderer.rules.link_open = (tokens, index, options, _env, renderer) => {
  tokens[index].attrSet('target', '_blank');
  tokens[index].attrSet('rel', 'noopener noreferrer');
  tokens[index].attrSet('data-markdown-link', '');
  return renderer.renderToken(tokens, index, options);
};
export function renderMarkdown(source: string): string { return markdown.render(source); }

export function toggleMarkdownTask(source: string, index: number): string {
  const tasks = markdown.parse(source, {}).filter(token => token.meta?.taskLine !== undefined);
  const lineNumber = tasks[index]?.meta?.taskLine;
  if (!Number.isInteger(index) || index < 0 || typeof lineNumber !== 'number') return source;
  const lines = source.split('\n');
  lines[lineNumber] = lines[lineNumber].replace(/\[([ xX])\](?=\s|$)/, (_marker, value: string) => value === ' ' ? '[x]' : '[ ]');
  return lines.join('\n');
}

export function drawMarkdown(group: SVGGElement, object: DeskObject) {
  const foreign = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
  foreign.setAttribute('width', String(object.width)); foreign.setAttribute('height', String(object.height));
  const content = document.createElement('div'); content.className = 'markdown-text';
  content.style.color = object.textColor; content.style.fontSize = `${object.fontSize}px`;
  content.style.padding = `${object.padding ?? 6}px`;
  content.style.borderRadius = `${Math.min(object.cornerRadius, object.width / 2, object.height / 2)}px`;
  // Only parser-generated HTML is inserted; raw HTML and embedded images are disabled.
  content.innerHTML = renderMarkdown(object.text);
  content.querySelectorAll<HTMLInputElement>('[data-markdown-task]').forEach(input => { input.disabled = false; });
  foreign.append(content); group.append(foreign);
}
