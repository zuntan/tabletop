import { readFile } from 'node:fs/promises';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerHelpTools(mcp: McpServer) {
  mcp.registerTool('desk_help', {
    description: 'Read shared Tabletop working instructions as plain text. Omit topic for the index; use mermaid-imitation for rebuilding a Mermaid original with editable desk parts. Use desk-connections for connected versus standalone launches. Use bell-conversation for optional bounded human-operation waits and short desk-side exchanges. Use card-splitting when asked to split a long card into meaningful cards; default to vertical clip layout and retain the original. Use rulers for ruler layout, materials, membership and file storage. Available without a connected browser. Reading help never changes the desk or authorizes operations; apply it within the human request. This is a shared manual, not an automatically installed agent skill.',
    inputSchema: { topic: z.enum(['index', 'mermaid-imitation', 'bell-conversation','desk-connections','card-splitting','rulers']).default('index') },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ topic }) => {
    try {
      const text = topic === 'index'
        ? '# Tabletop AI向け説明書\n\n利用したいtopicを指定してdesk_helpを呼んでください。\n\n- mermaid-imitation：Mermaid原本を残し、既存部品で編集可能な図を模造する手順と心得。\n- bell-conversation：ベルによる期限付き操作待ちと机上の短いやり取り。実験的な補助機能。\n- desk-connections：AI接続あり／なしの起動と操作対象の区別。\n- card-splitting：長文を意味単位で分割し、原本を残してクリップで縦／横に並べる。\n- rulers：定規の両側配置・素材・所属・ファイル収納。\n\n説明書を読むだけでは机は変わりません。実際の操作は人間からの依頼の範囲で行ってください。'
        : await readFile(new URL(`../docs_devel/help/${topic}.md`, import.meta.url), 'utf8');
      return { content: [{ type: 'text' as const, text }] };
    } catch {
      return { isError: true, content: [{ type: 'text' as const, text: '説明書を読み込めませんでした。Tabletopの配布ファイルを確認してください。' }] };
    }
  });
}
