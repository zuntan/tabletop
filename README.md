# Tabletop

人間とAIが同じ2D作業机を操作するローカル試作です。仕様の原本は [concept.md](./concept.md) です。プレリリース候補の検証結果・次の共同作業テスト・既知の制限は [PRERELEASE.md](./PRERELEASE.md) を参照してください。

机の文具（磁石・クリップ・リアクション等）と外部AIからのHTTPS参照の検討案は [DIRECTIONS.md](./DIRECTIONS.md) に記録しています。実装済みの指差し・リアクションと、今後の構想を区別しています。最初のHTTPS実験の対象はおっさんです。

2026-10-15の机上整理・追加案・実装済みとの切り分けは [IDEAS.md](./IDEAS.md)、おっさんの指示書原文は [追加アイデア集](./docs/ideas-from-ossan-2026-10-15.md) を参照してください。いずれも一括した実装依頼ではありません。

About・MIT採用方針・第三者ライセンスと素材の確認は [公開準備メモ](./docs/public-info-and-license.md) に記録しています。正式なライセンス整備・監査・About実装はまだ完了していません。

## 起動

Node.js 22.12以降（この環境では24.15）を使用してください。

```sh
npm install
npm run build
npm start
```

AIがMCPで初回受付を開いた後、案内された `http://127.0.0.1:4317/#token=...&port=4317` をブラウザで開きます。URLのトークンは画面起動時に除去されます。上部の「保存」で机を画像込みの `.tabletop`（ZIP）に保存し、「読込」で再開できます。自動保存はなく、Undo履歴はタブ内のみです。対象・制限は [保存・読込](./docs/save-load.md) を参照してください。

`npm start` は開発用の手動起動手順です。通常は下記のMCP設定でエージェントにサーバーを起動させ、初回ペアリングを行います。URLだけでは共有の受付は開きません。AIなしの単独起動の整備は今回の対象外です。手動起動したサーバーは先にCtrl+Cで停止します。同じポートで二重起動はできません。

## CLIエージェントのMCP設定

Windows＋GitHub Copilot CLIの導入・MCP設定は [Windows向け手順](./docs/windows-copilot-cli.md) を参照してください。Windows実機での動作確認状況と既知の制限も記載しています。

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

MCPの `desk_connection_info` を呼ぶとブラウザ未接続でも現在の接続先を取得できます。トークン未指定なら、起動時に生成したトークン付きURLを返します。`env.TABLETOP_TOKEN` を指定した場合は固定トークンを返しません。利用者がURL末尾に `#token=URLエンコードした設定済みトークン` を手動で付けて使用します。

「接続」タブはURL入力だけです。トークンを含むURLを丸ごと貼り「接続」を押します。ページ移動・再読込はしません。URLは伏せ字表示でタブ内に保持し、解放後の手動再接続にも使えます。トークンなしURLやポート不一致は拒否します。LAN接続はAIが明示許可した場合のみ可能です。[HTTP LAN試用](./docs/http-lan.md) を参照してください。

初回・手動置換は利用者の了承後に `desk_pairing_open({ confirm: true })` で受付を開きます。接続後はAIが `desk_pairing_info` を非公開で保持し、サーバー再起動後は `desk_pairing_restore({ pairing })` で既知の机だけを復帰させます。固定トークンでもペアリング確認を省略しません。通常の切断は控えめな「AI再接続待ち」、確認不能時は手動接続を案内します。[接続復帰・旧版からの更新](./docs/connection-recovery.md) を参照してください。

ランダム生成時は標準エラーログにも起動URLを表示します。env指定時はログにも固定トークンを表示しません。接続URL取得はMCP側だけで、HTTPにトークン取得口はありません。

- `TABLETOP_PORT`：省略時4317。
- `TABLETOP_TOKEN`：省略時は起動ごとに128ビット乱数・base64urlの22文字を自動生成。明示する場合は22文字以上で、十分にランダムな値にしてください。従来の長い値も使用できます。復帰recordの秘密は従来どおり別管理です。
- トークン生成例：`node -e "console.log(require('node:crypto').randomBytes(16).toString('base64url'))"`
- トークンは秘密情報です。公開リポジトリや公開チャットへ貼らないでください。ランダム生成時の接続URLをMCPで取得して案内すると、AIの会話履歴にトークンが残る可能性があります。非開示で使う場合はenv指定＋手動入力にしてください。
- 一つのサーバーにつき接続できる作業机タブは一つです。複数エージェントの同時接続・共同編集は未対応です。

## 操作

- ヘッダーの「✎」で棚の名前を編集。名前は保存・読込で引き継ぎ、ダウンロード名は `棚の名前.tabletop`（未設定は `無題.tabletop`、時刻なし）。隣の短い棚IDは同名の棚を指し分ける目印で、ファイルには保存しません。[仕様・旧ファイルとの互換性](./docs/desk-identity.md)。
- ヘッダーの「ひとりで考える」は固定ラベルのスイッチです。ONではAIは読み取りと会話・保存だけになり、編集・選択・指差し・接続解放は実行しません。OFFではAIといっしょに考えます。人間の編集は続けられます。再接続では維持し、ページ再読み込みではOFFへ戻ります。ファイルには保存しません。OFFに戻しても停止した操作は自動再実行しません。
- 上部のツールで矩形・角丸矩形・楕円・線・矢印・テキスト・画像・SVG・Web資料・リンク・ピンを追加。
- 上部の色・線幅は新規作成の既定値になり、選択中の対象にも即時適用します。選択だけでは既定値は変わりません。
- 「ピンを配置」は最後に選んだ体系を即座に配置。「ピン設定」で書式・色・枠を設定できます。デフォルトはタイトな地図ピン型。「文字に枠を合わせる」で既存の枠も調整できます。説明文はダブルクリックで編集し、「ピン設定」のすぐ右の「ピンテキスト」で一括非表示にできます。
- 「リアクション」のすぐ右の「スナップ」は初期ON、既定間隔24・原点0。ON／OFF・間隔・原点を机と一緒に保存し、変更は共通Undoの対象です。ピンは番号枠の下中央（地図ピン型では先端）を合わせます。AIも同じ設定に従い、`snap: "exact"` でバッチ単位に回避できます。詳しくは [共通スナップ](./docs/shared-snap.md) を参照してください。
- 画像／SVGはタイトル付きカードです。ダブルクリックでタイトルと任意のHTTP(S) URLを編集し、URLがある場合は右上の「↗」で別タブを開けます。タイトルと画像は一緒に移動・サイズ変更します。
- ファイル選択・ドロップ・Ctrl+Vに加え、「クリップボードから追加」ボタンでも画像を追加できます。コピーしたSVGコードも画像化します。ボタンはブラウザの読み取り許可が必要です。
- クリックで選択、Shift＋クリックで複数選択、空白領域のドラッグで範囲選択（完全に囲んだものが対象）。
- 選択したオブジェクトをドラッグして移動。線・矢印・ピン以外は単一選択時の右下ハンドルでサイズ変更。
- 線・矢印は両端の丸をドラッグして端点移動、線の近傍をドラッグして全体移動。図形の上下左右に近づけるとスナップして接続し、移動・サイズ変更に追従します。
- 接続済みの端を離すと解除。線全体を移動すると両端の接続を解除します。接続中の端は緑色です。
- 接続できる図形・ピン・Markdownメモを2個選択して線／矢印を追加すると、向かい合う辺で自動接続。1個なら起点だけを接続します。0個・3個以上ならフリー作成。
- 塗りは初期70%透過。上部の「塗り透過%」やプロパティから調整し、文字・輪郭の濃さは維持します。
- 図形・単独テキスト・リンク・Web資料をダブルクリックしてその場編集。初期はEnterで確定、Shift＋Enterで改行。編集欄の小さな「⇄」で「Enter改行／Ctrl・⌘＋Enter確定」に切替・記憶し、隣のヒントで操作を確認できます。Esc取消、外クリック確定にも対応。URLと表示名も編集できます。
- リンク・Web資料カード右上の「↗」をクリックすると別タブで開きます。本体は選択・移動用のままです。「↗」にキーボードでフォーカスしてEnterでも開けます。
- 右側の色ボタンで丸いパレットを開きます。7系統×明暗6段階＋透明。塗り、輪郭・矢印、文字を個別に変更でき、複数選択にも対応します。
- 右側で位置・寸法・テキスト等を編集。最前面・最背面は左ツール群から操作でき、未選択時は無効です。詳しい仕様は [図示操作](./DIAGRAM.md) を参照してください。
- ツールは短い文字キャプション付きで、左・中央は空き幅を使って伸びます。左ツール群の最前面・最背面の隣にある「リアクション ▾」から18種類・7列の一覧を開き、対象を変えながら付け外しできます。⭕・❌にも対応。一覧はボタン再クリックかEscで閉じます。複数選択・共通Undoに対応し、ピンにも個別に付きます。AIも `update` の `reactions` 配列で同じ状態を編集できます。
- ホイールでズーム。Space＋ドラッグまたは中ボタンでパン。縮小・倍率・拡大・表示合わせは、プロパティ欄も含む作業エリア全体の右下のフローティングパネルにまとめています。未選択なら「全体」で机全体、人間の選択があれば「選択範囲」でその全パーツが余白付きで収まるように表示します。パーツの座標・サイズは変えません。AIは独立した緑枠を `desk_point` で指定して `desk_fit` で同様に表示できます。
- Delete / Backspaceで削除。Ctrl / Cmd＋ZでUndo。Ctrl / Cmd＋Shift＋ZまたはCtrl＋YでRedo。Ctrl / Cmd＋Aで全選択。
- Web資料は閲覧用iframeです。iframe内の操作は無効にして、作業机上での選択・移動を優先します。埋め込みを禁止するサイトもあるため、カード右上の「↗」または選択時の「元のページをブラウザで開く」を使用できます。
- 一部の操作はタッチの単一ポインタでも利用できます。ピンチズームは未対応です。

## MCPツール

AI向けの使い方・接続線・ピン体系・画像／SVGの受け渡しは [AI_INTERFACE.md](./AI_INTERFACE.md) を参照してください。

| ツール | 用途 |
| --- | --- |
| `desk_connection_info` | 起動URL・待受状態・許可中のLAN URLを取得。env指定の固定トークンは非開示 |
| `desk_network_set` | 人間の明示了承後、同じポートのLAN待受を開閉。毎回の起動はローカル限定 |
| `desk_release` | 人間の了承後、棚を保持して接続と自動再接続を止め、新規・手動接続の受付を開く |
| `desk_pairing_open` | 人間の了承後に初回・手動置換の受付を開く。復帰には使わない |
| `desk_pairing_info` | 非公開で保持する復帰用recordを取得。秘密情報を含む |
| `desk_pairing_restore` | 再起動後に以前のrecordを指定し、既知の机だけ復帰を許可 |
| `desk_summary` | 棚の名前・短い棚ID、sessionId、revision、種類別件数、Undo / Redo可否 |
| `desk_list` | 背面から前面順の一覧。画像の大容量データは省略 |
| `desk_get` | ID指定の詳細。画像ソースを含む |
| `desk_state` | 全状態。大きくなるため必要時だけ使用 |
| `desk_context` | 状態・接続関係・ピン体系のメンバー・履歴を一回で取得（画像データなし） |
| `desk_save` | サーバーの専用フォルダーへ `.tabletop` を保存。上書き禁止 |
| `desk_load` | 明示確認とsession／revisionガード付きで読込。共通Undo対応。[詳細](./docs/mcp-save-load.md) |
| `desk_asset_read` | 画像をMCP imageブロック、SVGをソースで取得。任意で一時ファイル出力 |
| `desk_asset_import` | ファイル・SVGコード・data URLから追加／画像だけ差し替え |
| `desk_settings` | 棚の名前、共有スナップ設定、新規作成の既定スタイルとピン体系、次番号 |
| `desk_selection` | 人間の選択ID、AI指差しID（`aiPointing`）、最後に観測したキャンバスポインタ座標 |
| `desk_select` | 人間の編集用選択を変更。AIの指差しには `desk_point` を使用 |
| `desk_point` | 人間の青い選択を変えず、緑枠でAIが指差す。`ids: []` で解除。履歴・revisionには記録しない |
| `desk_fit` | AIの緑枠があればその範囲、なければ机全体へ滑らかに表示合わせ。任意の `durationMs`。人間の入力でその場で中断。選択・文書・履歴は変えない |
| `desk_camera_get` | 現在の画面中心・倍率・キャンバス寸法・机上の表示範囲を取得。画面は動かさない |
| `desk_camera_move` | 中心座標／相対パン、倍率／相対倍率で滑らかに表示調整。任意の `durationMs`（0は瞬時）。人間の入力でその場で中断。パーツ・選択・履歴は変更しない |
| `desk_changes` | 指定revision以降の変更。`nextRevision`でページ送り |
| `desk_execute` | 追加・更新・削除・前後関係変更の原子的な一括操作 |
| `desk_undo` | 操作主体によらず最後の共通操作を取り消す |
| `desk_redo` | 共通操作をやり直す |

### 一括操作の例

`desk_execute` の引数（省略時は `snap: "desk"` で現在の格子に従います。厳密な座標には `"exact"` を指定し、応答の `placement.results` で実際の位置を確認します）：

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

UIの開発時はサーバーと別ターミナルで `npm run dev` を起動し、`http://127.0.0.1:5173` の接続フォームへサーバーの接続URLを丸ごと貼ります（開発UIの5173番ではなく、接続先サーバーのポートを含むURL）。

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
- 永続化、全体エクスポート、図形の回転、グループ化、高度な編集、複数作業机の一元管理・複数ユーザー同期は対象外。
- 複数の棚の切り替えは、了承付きの `desk_release` で接続を解放し、使いたい棚から手動接続する運用が可能です。元の棚は保持され、自動再接続は停止します。保存・読込・同期とは別です。[手順](./docs/connection-recovery.md)を参照してください。
- AIクライアント固有のMCP設定は各クライアント側で必要です。Tabletop自身はAIやチャットUIを提供しません。

## 技術資料

- [MCP TypeScript SDK v1.x](https://github.com/modelcontextprotocol/typescript-sdk/tree/v1.x)
- [SDK server documentation](https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.x/docs/server.md)
- [Vite](https://vite.dev/guide/)
- [SVG image](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/image)
- [iframe sandbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#sandbox)
- [Playwright](https://playwright.dev/docs/intro)
