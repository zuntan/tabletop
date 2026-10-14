import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../src/markdown';

test('Markdown supports text structure without tables, images or executable HTML', () => {
  const html = renderMarkdown('# Heading\n\n**bold** *italic* ~~gone~~\nnext\n\n- one\n- two\n\n1. first\n\n> quote\n\n`inline`\n\n```js\nconst value = 1;\n```');
  for (const tag of ['h1', 'strong', 'em', 's', 'br', 'ul', 'ol', 'blockquote', 'code', 'pre']) assert.match(html, new RegExp(`<${tag}[ >]`));
  const unsafe = renderMarkdown('<script>alert(1)</script>\n\n![image](https://example.com/a.png)\n\n| a | b |\n| - | - |\n| c | d |');
  assert.doesNotMatch(unsafe, /<(script|img|table)\b/);
  assert.match(unsafe, /&lt;script&gt;/);
});
test('only absolute HTTP(S) links are rendered and open safely in separate tabs', () => {
  const safe = renderMarkdown('[example](https://example.com/)');
  assert.match(safe, /target="_blank"/); assert.match(safe, /rel="noopener noreferrer"/);
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///tmp/a', '/relative', '#anchor', 'mailto:a@example.com']) {
    assert.doesNotMatch(renderMarkdown(`[link](${url})`), /<a\b/);
  }
});
