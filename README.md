# Tabletop

人間とAIが同じ2D作業机を操作するローカル試作です。仕様の原本は [concept.md](./concept.md) です。

## 起動

Node.js 22.12以降（この環境では24.15）を使用してください。

```sh
npm install
npm run build
npm start
```

標準エラー出力に表示される `http://127.0.0.1:4317/#token=...&port=4317` をブラウザで開きます。トークンは接続後にURLから除去されます。タブを開いている間だけ状態と履歴を保持します。

`npm start` だけでも人間向けUIを試せます。AIから使う場合は、下記のMCP設定でエージェントにサーバーを起動させてください。手動起動したサーバーは先にCtrl+Cで停止します。同じポートで二重起動はできません。

## CLIエージェントのMCP設定

一般的な `mcpServers` 形式の例です。クライアントごとの設定ファイルの場所・書式に合わせてください。パスはこの環境の絶対パスです。

```json
{
  "mcpServers": {
    "tabletop": {
      "command": "node",
      "args": [
        "--import",
        "/opt2/_dev/tabletop/node_modules/tsx/dist/loader.mjs",
        "/opt2/_dev/tabletop/src/server.ts"
      ]
    }
  }
}
```

エージェントが起動したサーバーの標準エラーログからURLを開きます。ログを見られないクライアントでは、上記設定に `env` を追加して `TABLETOP_TOKEN` を設定し、ブラウザ右側の接続フォームから同じトークンを入力してください。

- `TABLETOP_PORT`：省略時4317。
- `TABLETOP_TOKEN`：省略時は起動ごとにランダム生成。明示する場合は24文字以上で、十分にランダムな値にしてください。
- トークン生成例：`node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`
- トークンは秘密情報です。公開リポジトリやチャットに貼らないでください。
- 一つのサーバーにつき接続できる作業机タブは一つです。複数エージェントの同時接続・共同編集は未対応です。

## 操作

- 上部のツールで矩形・角丸矩形・楕円・線・矢印・テキスト・画像・SVG・Web資料・リンク・ピンを追加。
- 上部の色・線幅は新規作成の既定値になり、選択中の対象にも即時適用します。選択だけでは既定値は変わりません。
- 「ピンを配置」は最後に選んだ体系を即座に配置。「ピン体系」で書式・色・枠を設定できます。デフォルトはタイトな地図ピン型。「文字に枠を合わせる」で既存の枠も調整できます。説明文はダブルクリックで編集し、表示グループで一括非表示にできます。
- 表示グループのグリッド吸着（初期OFF）は机上24単位。ピンは番号枠の下辺中央（地図ピン型では先端）が原点です。詳しくは [作成・編集・ピン](./AUTHORING.md) を参照してください。
- 画像／SVGはタイトル付きカードです。ダブルクリックでタイトルと任意のHTTP(S) URLを編集し、URLがある場合は右上の「↗」で別タブを開けます。タイトルと画像は一緒に移動・サイズ変更します。
- ファイル選択・ドロップ・Ctrl+Vに加え、「クリップボードから追加」ボタンでも画像を追加できます。コピーしたSVGコードも画像化します。ボタンはブラウザの読み取り許可が必要です。
- クリックで選択、Shift＋クリックで複数選択、空白領域のドラッグで範囲選択（完全に囲んだものが対象）。
- 選択したオブジェクトをドラッグして移動。線・矢印・ピン以外は単一選択時の右下ハンドルでサイズ変更。
- 線・矢印は両端の丸をドラッグして端点移動、線の近傍をドラッグして全体移動。図形の上下左右に近づけるとスナップして接続し、移動・サイズ変更に追従します。
- 接続済みの端を離すと解除。線全体を移動すると両端の接続を解除します。接続中の端は緑色です。
- 図形・単独テキスト・リンク・Web資料をダブルクリックしてその場編集。Enterで確定、Shift＋Enterで改行、Escで取消、外クリックで確定。URLと表示名も編集できます。
- リンク・Web資料カード右上の「↗」をクリックすると別タブで開きます。本体は選択・移動用のままです。「↗」にキーボードでフォーカスしてEnterでも開けます。
- 右側の色ボタンで丸いパレットを開きます。7系統×明暗6段階＋透明。塗り、輪郭・矢印、文字を個別に変更でき、複数選択にも対応します。
- 右側で位置・寸法・テキスト等を編集。最前面・最背面の操作も可能。詳しい仕様は [図示操作](./DIAGRAM.md) を参照してください。
- ホイールでズーム。Space＋ドラッグまたは中ボタンでパン。「全体表示」で全オブジェクトに合わせます。
- Delete / Backspaceで削除。Ctrl / Cmd＋ZでUndo。Ctrl / Cmd＋Shift＋ZまたはCtrl＋YでRedo。Ctrl / Cmd＋Aで全選択。
- Web資料は閲覧用iframeです。iframe内の操作は無効にして、作業机上での選択・移動を優先します。埋め込みを禁止するサイトもあるため、カード右上の「↗」または選択時の「元のページをブラウザで開く」を使用できます。
- 一部の操作はタッチの単一ポインタでも利用できます。ピンチズームは未対応です。

## MCPツール

AI向けの使い方・接続線・ピン体系・画像／SVGの受け渡しは [AI_INTERFACE.md](./AI_INTERFACE.md) を参照してください。

| ツール | 用途 |
| --- | --- |
| `desk_summary` | sessionId、revision、種類別件数、Undo / Redo可否 |
| `desk_list` | 背面から前面順の一覧。画像の大容量データは省略 |
| `desk_get` | ID指定の詳細。画像ソースを含む |
| `desk_state` | 全状態。大きくなるため必要時だけ使用 |
| `desk_context` | 状態・接続関係・ピン体系のメンバー・履歴を一回で取得（画像データなし） |
| `desk_asset_read` | 画像をMCP imageブロック、SVGをソースで取得。任意で一時ファイル出力 |
| `desk_asset_import` | ファイル・SVGコード・data URLから追加／画像だけ差し替え |
| `desk_settings` | 新規作成の既定スタイルとピン体系、次番号 |
| `desk_selection` | 現在の選択IDと最後に観測したキャンバスポインタ座標 |
| `desk_select` | 選択IDの変更。履歴・revisionには記録しない |
| `desk_changes` | 指定revision以降の変更。`nextRevision`でページ送り |
| `desk_execute` | 追加・更新・削除・前後関係変更の原子的な一括操作 |
| `desk_undo` | 操作主体によらず最後の共通操作を取り消す |
| `desk_redo` | 共通操作をやり直す |

### 一括操作の例

`desk_execute` の引数：

```json
{
  "actor": "agent-01",
  "expectedRevision": 0,
  "operations": [
    {
      "kind": "add",
      "object": {
        "id": "note-001",
        "type": "text",
        "x": 120,
        "y": 80,
        "width": 360,
        "height": 100,
        "textColor": "#0f172a",
        "text": "ここを比較しましょう"
      }
    },
    {
      "kind": "add",
      "object": {
        "id": "frame-001",
        "type": "rect",
        "x": 100,
        "y": 60,
        "width": 400,
        "height": 160,
        "fill": "transparent",
        "stroke": "#2563eb"
      }
    }
  ]
}
```

オブジェクトの `type` は `rect / ellipse / line / arrow / text / image / svg / web / link`。`image / svg` には `src`（HTTP(S) URLまたはbase64画像data URL）、`web / link` には `url`（HTTP(S) URL）が必要です。外部図表のSVGは画像として一つのオブジェクトにします。線・矢印は始点 `x,y` と終点 `x2,y2` を持ち、任意方向を指定できます。接続と色のMCP仕様は [DIAGRAM.md](./DIAGRAM.md) を参照してください。

更新は `{"kind":"update","id":"note-001","patch":{"x":200}}`、削除は `{"kind":"delete","id":"note-001"}`、前後関係は `{"kind":"reorder","id":"note-001","index":0}` です。indexは背面から数えた位置で、範囲を超えた値は最前面になります。

`expectedRevision` は任意です。AIによる変更では指定を推奨します。競合すると全操作を適用せずエラーを返します。操作中のドラッグや画像読み込みがある場合も、MCP要求は適用せずエラーを返します。

### 履歴と差分

- 人間とAIは同じ `Desk.execute` と共通Undo / Redo履歴を使います。
- 一括操作とドラッグ1回はそれぞれ1履歴です。状態の変わらない操作は記録しません。
- Undo / Redoも新しい変更イベントなのでrevisionは単調増加します。
- 新しい操作を確定するとRedo履歴を破棄します。
- `desk_changes` の `details` は変更前後のオブジェクト情報と配列位置を含み、削除された対象も識別できます。画像ペイロードは含みません。
- 差分取得は `{"sinceRevision":20,"limit":100}`。`hasMore` がtrueなら `nextRevision` を次の `sinceRevision` として取得してください。
- タブの再読み込みで新しい `sessionId` とrevision 0になります。AIはsessionIdが変わったら以前のrevisionを使わず、状態を取得し直してください。
- 要求IDを使い、応答待ち10秒でタイムアウトします。切断・タイムアウト時は適用済みか不明な場合があるため、自動再送しません。再接続後、revisionと対象の状態を確認し、必要なら `expectedRevision` を指定して再実行します。

## 開発・検証

```sh
npm test
npm run build
npm run test:e2e
```

E2EはPlaywrightで実ブラウザとstdio MCPクライアントを起動します。この環境では `/usr/bin/google-chrome` を使用。別環境では `npx playwright install chromium`、または `TABLETOP_CHROME` に実行ファイルのパスを設定してください。先に `npm run build` が必要です。

UIの開発時はサーバーと別ターミナルで `npm run dev` を起動し、`http://127.0.0.1:5173` の接続フォームからサーバーのトークンを入力します。

構成：

- `src/model.ts`：検証付きオブジェクトモデル、共通操作、履歴、要求ディスパッチ。
- `src/main.ts`：SVG描画、選択・ジェスチャー・プロパティUI、WebSocketクライアント。
- `src/server.ts`：stdio MCPツール、ローカルHTTP配信、WebSocket中継。
- `tests/model.test.ts`：状態・履歴・原子性・入力検証。
- `tests/bridge.test.ts`：実stdio接続、ツール操作、接続認証、切断。
- `tests/browser.e2e.ts`：実ブラウザで人間操作とAI操作を混在させた検証。

## 安全性・試作の制限

- HTTPサーバーはIPv4ループバックのみ。WebSocketはトークン・Host・Originを検証し、一つのブラウザ接続に限定。
- SVGは `image` 要素で表示し、SVGソースやオブジェクトのテキストをHTMLとして挿入しません。
- iframeは `sandbox="allow-scripts"`。同一オリジン権限・フォーム送信・ポップアップ等は許可しません。
- ローカル配信にCSPとReferrer-Policyを設定。リンクは別タブで `noopener noreferrer` を使用。
- 外部画像・Webページはブラウザからアクセスするため、相手先にネットワーク通信が発生します。信頼できるURLを使ってください。
- 履歴はメモリ内スナップショット方式で、圧縮・保持上限・アセットストア分離は未実装。長時間・大量画像の作業ではメモリ消費が増えます。
- 上限：オブジェクト2000個、一括操作200件、ファイル画像1枚5MB。外部画像URLでは表示不能・読み込み失敗の可能性があります。
- 永続化、全体エクスポート、図形の回転、グループ化、高度な編集、複数作業机・複数ユーザー同期は対象外。
- AIクライアント固有のMCP設定は各クライアント側で必要です。Tabletop自身はAIやチャットUIを提供しません。

## 技術資料

- [MCP TypeScript SDK v1.x](https://github.com/modelcontextprotocol/typescript-sdk/tree/v1.x)
- [SDK server documentation](https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.x/docs/server.md)
- [Vite](https://vite.dev/guide/)
- [SVG image](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/image)
- [iframe sandbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#sandbox)
- [Playwright](https://playwright.dev/docs/intro)
