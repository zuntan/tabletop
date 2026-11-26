import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, toggleMarkdownTask } from '../src/markdown';

test('Markdown supports text structure without images or executable HTML', () => {
  const html = renderMarkdown('# Heading\n\n**bold** *italic* ~~gone~~\nnext\n\n- one\n- two\n\n1. first\n\n> quote\n\n`inline`\n\n```js\nconst value = 1;\n```');
  for (const tag of ['h1', 'strong', 'em', 's', 'br', 'ul', 'ol', 'blockquote', 'code', 'pre']) assert.match(html, new RegExp(`<${tag}[ >]`));
  const unsafe = renderMarkdown('<script>alert(1)</script>\n\n![image](https://example.com/a.png)\n\n| a | b |\n| - | - |\n| c | d |');
  assert.doesNotMatch(unsafe, /<(script|img)\b/);
  assert.match(unsafe, /<table>/);
  assert.match(unsafe, /&lt;script&gt;/);
});
test('tables retain column alignment and inline formatting', () => {
  const html = renderMarkdown('| 左 | 中央 | 右 |\n| :--- | :---: | ---: |\n| **太字** | 日本語 | 123 |');
  assert.match(html, /<table>/);
  for (const align of ['left', 'center', 'right']) assert.ok(html.includes(`text-align:${align}`));
  assert.match(html, /<strong>太字<\/strong>/);
});
test('task markers render disabled checkboxes only at the start of list items', () => {
  const html = renderMarkdown('- [ ] 未完了\n- [x] **完了**\n  - [X] 子項目\n\n[ ] 普通の文章\n\n`- [x] code`');
  assert.equal((html.match(/type="checkbox"/g) ?? []).length, 3);
  assert.equal((html.match(/disabled checked/g) ?? []).length, 2);
  assert.match(html, /\[ \] 普通の文章/);
  assert.match(html, /<code>- \[x\] code<\/code>/);
});
test('automatic HTTP links use the existing link policy and skip code', () => {
  const html = renderMarkdown('https://example.com/path\nhttp://example.org\n\n`https://code.example`\n\n```\nhttps://block.example\n```\n\nwww.example.com a@example.com');
  assert.equal((html.match(/<a /g) ?? []).length, 2);
  assert.equal((html.match(/rel="noopener noreferrer"/g) ?? []).length, 2);
});
test('task toggles preserve source and target nested items rather than code markers', () => {
  const source = '```\r\n- [x] code\r\n```\r\n\r\n> - [ ] **first**\r\n>   - [X] nested\r\n';
  assert.equal(toggleMarkdownTask(source, 0), source.replace('[ ] **first**', '[x] **first**'));
  assert.equal(toggleMarkdownTask(source, 1), source.replace('[X] nested', '[ ] nested'));
  assert.equal(toggleMarkdownTask(source, 99), source);
  assert.doesNotMatch(renderMarkdown('- \\[ ] literal'), /type="checkbox"/);
});
test('only absolute HTTP(S) links are rendered and open safely in separate tabs', () => {
  const safe = renderMarkdown('[example](https://example.com/)');
  assert.match(safe, /target="_blank"/); assert.match(safe, /rel="noopener noreferrer"/);
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///tmp/a', '/relative', '#anchor', 'mailto:a@example.com']) {
    assert.doesNotMatch(renderMarkdown(`[link](${url})`), /<a\b/);
  }
});
