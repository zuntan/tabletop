import MarkdownIt from 'markdown-it';
import type { DeskObject } from './model';

const markdown = new MarkdownIt({ html: false, breaks: true, linkify: false, typographer: false })
  .disable(['table', 'image']);
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

export function drawMarkdown(group: SVGGElement, object: DeskObject) {
  const foreign = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
  foreign.setAttribute('width', String(object.width)); foreign.setAttribute('height', String(object.height));
  const content = document.createElement('div'); content.className = 'markdown-text';
  content.style.color = object.textColor; content.style.fontSize = `${object.fontSize}px`;
  content.style.padding = `${object.padding ?? 6}px`;
  content.style.borderRadius = `${Math.min(object.cornerRadius, object.width / 2, object.height / 2)}px`;
  // Only parser-generated HTML is inserted; raw HTML and embedded images are disabled.
  content.innerHTML = renderMarkdown(object.text);
  foreign.append(content); group.append(foreign);
}
