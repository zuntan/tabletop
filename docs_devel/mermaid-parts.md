# Mermaid原本パーツ

2026-10-20、`feat/mermaid-parts`。Mermaid 12.2.0を同梱する。

## 範囲

Mermaidソースを保持して一枚の図として表示する原本パーツ。Tabletop部品への変換、相互変換、Mermaid専用の図形編集操作は実装しない。原本の隣へAIが既存部品で模造する作業は、共通説明書として`desk_help`の`mermaid-imitation`トピックから取得できる。原文は[Mermaid模造手順](./help/mermaid-imitation.md)。エージェントへのSKILL登録は行わない。

## 人間の操作

- ツールバー「Mermaid」から作成。タイトルとソースの入力欄を開く。
- ソースのEnterは改行、Ctrl/⌘＋Enterで確定、Escで取り消し。欄外クリックでも確定する。
- ダブルクリックでタイトルとソースを再編集できる。プロパティ欄からも編集できる。
- 移動、リサイズ、ロック、重なり順、リアクション、机内コピー、Undo/Redoは通常のカードと共通。
- 画像カテゴリの一覧に含む。テキストクリップボードへはソースを出力する。
- 構文エラーはカード上に表示し、ソースは失わない。再編集して修正できる。

## 保存とAI操作

`type: "mermaid"`、`mermaidSource`（必須、最大100000文字）、`text`（タイトル）、`x/y/width/height`、`locked/reactions`を保存する。表示用SVGはブラウザのキャッシュであり、保存データへ重複して埋め込まない。ソースと図の不一致を避け、ロード時に再生成する。既存のファイル形式version 1を使用する。

```json
{
  "kind": "add",
  "object": {
    "id": "mermaid-example",
    "type": "mermaid",
    "x": 0,
    "y": 0,
    "width": 480,
    "height": 354,
    "text": "処理の流れ",
    "mermaidSource": "flowchart LR\n  A[開始] --> B[終了]"
  }
}
```

- `desk_execute`のadd/updateで作成・更新。
- `desk_get`、`desk_context`でソース取得。
- MCPの`desk_asset_read`で現在のソースからSVGを生成し、`svg`、`mermaidSource`、読み取り対象の`revision`を返す。`exportFile`も利用可能。描画エラーは編集せずに返す。
- 描画は非同期なので、返されたrevision以降の編集は結果に含まれない。ソースとSVGは同じ読み取り時点の組で返す。
- HTTP共有のcontext/getでもソースを読める。HTTPのasset_readは従来の埋込画像/SVGのみで、Mermaid再生成には非対応。

## 描画

ブラウザ内の公式`mermaid.render()`でSVGを生成する。外部の図生成APIやCDNは使用しない。ライブラリと図種別のコードは必要時にローカルから読み込む。ライブラリ同梱による配布サイズ増加と、初回描画の読み込みがある。

生成SVGは画像として表示し、机のDOMへ実行可能なSVGとして挿入しない。strict設定でクリック機能を無効化し、HTMLラベルは使わない。ソースからセキュリティ設定やカスタムCSS等を上書きさせない。外部画像を参照する記法は今回未対応で、ソースを保持したままエラーを表示する。

UIテーマは原本の色に連動させない。Mermaid既定テーマで描画し、ソースによる図のスタイルは基本的にそのまま扱う。図全体はカード内に等比で収める。

描画結果はソース単位、直近32件をキャッシュする。同一ソースの並行リクエストは同じ描画を待ち、移動やリサイズでソースの再描画を要求しない。サイズ変更は画像の表示枠を変える。

## 検証

単体：保存・復元、必要な公開プロパティ、ソース必須、無効ソースの保持とUndo、コピー、HTTP読み取り。
ブラウザ：フローチャート、日本語シーケンス図、SVG画像の実デコード、ソースとSVGのMCP取得、エラーと修正、Undo/Redo、保存復元、ツールバー作成、ダブルクリック編集、改行・確定キー、外部通信なし。

公式資料：
- https://mermaid.js.org/config/setup/mermaid/interfaces/RenderResult.html
- https://mermaid.js.org/config/schema-docs/config-properties-securitylevel.html
- https://mermaid.js.org/config/schema-docs/config.html

MermaidのMITライセンスを`public/licenses/mermaid.txt`に同梱し、Aboutから参照できる。
