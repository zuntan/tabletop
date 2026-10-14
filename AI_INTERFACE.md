# AIとの共同作業インタフェース

## ブラウザを接続する

`desk_connection_info` はブラウザ未接続でも呼べるサーバー側の参照ツールです。`url`・`port`・`tokenSource`・`tokenIncluded`・`browserConnected`・案内文を返します。トークンを再生成せず、机も変更しません。

`tokenSource: "generated"` なら、起動時に生成したトークン付きURLを利用者へ案内できます。URLはそのサーバープロセス中だけ有効ですが、ツール結果や案内によって会話履歴に残る可能性があります。公開しないでください。

`tokenSource: "environment"` なら、env指定の固定トークンはツール結果にも起動ログにも出しません。`url` は通常のURLで、利用者が「接続」タブへ設定済みトークンを手動入力します。AIは非開示のトークンを推測・取得する必要はありません。HTTPにはトークン取得口を設けません。

## 最初に読むもの

`desk_context` は、一回のブラウザ応答で次を返します。画像のbase64は含みません。

- `sessionId`・`revision`・件数・Undo/Redo可否・選択ID
- 背面から前面順のオブジェクト情報（Markdown原文や画像タイトルを含む）
- `connections`：線／矢印のID、始点・終点、接続先IDと辺。未接続は `binding: null`
- `settings.series`：ピン体系の書式・共通スタイル・次番号・`members`（ID、番号、表示文字、説明）
- `history`：現在の机で起きた変更と前後情報。初期値は先頭から100件

`history.hasMore` がtrueなら `sinceRevision: history.nextRevision` で続きを読みます。以後は最後に確認したrevisionから読み、`sessionId` が変わったら新しい机として扱います。差分の自動通知はありません。参照操作は机を変更しません。

細かい取得は従来の `desk_summary / desk_list / desk_get / desk_settings / desk_changes / desk_selection` も利用できます。`desk_state` は画像データを含む全状態なので大量画像の机では避けてください。

## 接続する

`desk_execute` の一括操作で、接続先と矢印を同時に作れます。

```json
{
  "actor": "agent-01",
  "expectedRevision": 0,
  "operations": [
    { "kind": "add", "object": { "id": "a", "type": "rect", "x": 100, "y": 100, "text": "開始" } },
    { "kind": "label_add", "id": "p1", "seriesId": "series-1", "x": 450, "y": 110, "description": "確認する" },
    { "kind": "add", "object": { "id": "edge", "type": "arrow", "startBinding": { "objectId": "a", "anchor": "right" }, "endBinding": { "objectId": "p1", "anchor": "left" } } }
  ]
}
```

辺は `top / right / bottom / left`。接続先は矩形・角丸矩形・楕円・全種類のピン・Markdownメモの枠です。画像・Webカードへの接続は現時点では対象外です。対象の移動・サイズ変更には追従します。解除は `update` の `patch: { "endBinding": null }`（またはstartBinding）。解除時の端点は保持します。UIは選択した1〜2個から自動接続を選べますが、MCPの追加はBindingを明示する方式のままです。

## 連番として扱う

ピンは内部型 `label`、同じ `seriesId` が同じ体系です。次の番号を計算して直接書くのではなく、`label_add` で追加します。現在最大番号＋1が体系の上限内で割り当てられます。上限では同じ番号を繰り返すため、番号だけで識別せずIDを使います。

体系のスタイル変更は `series_update`、個別位置・説明は `update`。既存ピンを勝手に採番し直しません。削除・移動・並べ替え・共通Undoも通常オブジェクトと同じです。

## Markdownメモ

`type: "text"` の `text` がMarkdown原文。文字色は `textColor`、背景は `fill`、輪郭は `stroke` です。既定の背景・輪郭は透明。図形の `text` はプレーンテキスト・中央配置です。Markdown対応範囲は [AUTHORING.md](./AUTHORING.md) を参照してください。

`fillOpacity` は塗りの不透明度0〜1で、文字・輪郭の不透明度とは独立です。新規作成の既定値と新規ピン体系は0.3（70%透過）。既存オブジェクトにこの属性がない場合のスキーマ既定値は1です。`defaults_update`・個別 `update`・`series_update` で変更でき、既存のオブジェクトは既定値の変更だけでは変わりません。画像やカードの本体はこの属性で薄くしません。

## 画像／SVGの読み取り

`desk_asset_read` に `id` を指定します。

- PNG／JPEG／GIF／WebP：メタデータのtextブロック＋標準MCP imageブロック（base64とMIME）
- SVG：textブロックのJSONに `svg` として元のSVGコード
- `exportFile: true`：加えてサーバー側の一時ファイル絶対パスを返す。クライアントが画像ブロックを扱えない場合の橋渡し

一時出力はOS一時領域（通常 `/tmp/tabletop-assets-*`）、ディレクトリ0700・ファイル0600・既存パスの上書きなし。参照だけの場合はファイルを作りません。出力はサーバープロセスごとに合計100MBまでで、出力ファイルは終了後も残ります。必要な受け渡しが終わった後の削除は利用者が行います。

サーバーとAI側の実行環境でファイルシステムを共有する必要があります。リモート画像URLはサーバーから取得しません（SSRF・意図しない通信を避けるため）。URL画像を読む場合は、利用者が許可した取得手段で一時ファイル化してから取り込んでください。

## 取り込み・差し替え

`desk_asset_import` の `source` は以下のいずれか一つです。

```json
{ "id": "figure", "source": { "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"240\" height=\"120\"><rect width=\"240\" height=\"120\" fill=\"orange\"/></svg>" }, "x": 100, "y": 200, "width": 240, "height": 154, "title": "図" }
```

```json
{ "id": "photo", "source": { "path": "/tmp/my-photo.png" }, "title": "資料" }
```

または `source: { "dataUrl": "data:image/png;base64,..." }`。ファイル形式は拡張子ではなくヘッダーで判別し、SVGは名前空間付きの単独文書のみ、DOCTYPE／ENTITYを拒否します。画像デコードの完全性検証はせず、表示はブラウザに委ねます。1枚5MB以下です。

`mode: "add"` が初期値。IDは一意で、既定サイズは480×354（タイトル欄34＋画像領域320）です。自然寸法に合わせる場合はwidthとheightを明示します。`title` はカードの `text`、`url` は任意リンク。

```json
{ "id": "figure", "mode": "replace", "source": { "path": "/tmp/replacement.svg" }, "expectedRevision": 12 }
```

差し替えは `src` だけを更新し、同じID・型・位置・サイズ・タイトル・リンクを保持します（画像形式を変えてもオブジェクト型は保持）。差し替え時のgeometry/title/url指定は拒否します。差し替え対象確認後はrevisionを自動でガードし、途中で机が変われば適用しません。

ファイル読み取りはサーバー側だけで行い、`TABLETOP_ASSET_ROOT` 以下の絶対パスに限定します（初期値はOS一時領域）。シンボリックリンクで許可領域外に出るパス、通常ファイル以外、上限超過は拒否します。必要なら専用共有ディレクトリを作り、環境変数でより狭く指定してください。MCPはローカルファイル読取権限を持つ信頼済みクライアント専用です。

## 変更・失敗・履歴

取り込み／差し替えも人間と共通の一回のUndoになります。`expectedRevision` はAI操作で指定を推奨します。編集やドラッグ中は再試行エラー。タイムアウトや切断で結果不明なら、同じ操作を直ちに再送せず現在revision・対象ID・履歴を確認してください。机を一回の応答で読んでも、その後の操作までロックされるわけではありません。

根拠：MCP SDK [tools](https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.x/docs/server.md)・[Node.js fs API](https://nodejs.org/docs/latest-v24.x/api/fs.html)。
