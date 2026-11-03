# パーツごとに意味のあるプロパティだけ出力する

2026-10-20、feat/meaningful-properties。

## 方針と範囲

0や既定値だから省略するのではなく、その種類で実際に使う項目かを基準にする。
内部の描画モデルは維持し、共通のpublishObjectで外向けの項目を選ぶ。
保存ファイルのmanifest、MCPのlist/get/context/state/changes、共有GETの取得で同じ規則を利用する。
画像のsrcはget/state/保存に保持。list/context/履歴/共有getでは従来通りassetメタデータで示す。

旧ファイルは引き続き読み込める。再保存すると無関係な項目が出なくなる。
入力Schemaと内部デフォルトの型分けは変更しない。保存形式versionも1のまま。
無関係な内部値の復元は保証する必要がないが、見た目・有効な値・接続・順序は保つ。
読み込み後に内部デフォルトが補われても、それを外向けに出し直すことはない。

## 出力の概要

| 種類 | 残すもの |
|---|---|
| 全パーツ共通 | id/type/x/y、指定済みのlocked/reactions |
| 線 | x2/y2、stroke/strokeWidth/dash、両端のマーカー・接着・接合 |
| テキスト | 幅高さ、塗り・輪郭・文字、角丸・余白・吹き出し |
| 図形 | 幅高さ、塗り・輪郭・文字、文字サイズ調整。角丸は角丸矩形だけ |
| ピン | シリーズ・番号・表示形・説明・留め先、幅高さと実際に使う外観 |
| 画像・SVG | 幅高さ、タイトルtext、src、任意リンクurl |
| Web資料・リンク | 幅高さ、タイトルtext、url |

線のwidth/heightは端点から導出されるため保存・一般取得では省く。placement.resultsの計算済みgeometryは従来通り。
線のfill/fillOpacity/text/fontSize等は描画に使わないため出さない。
メディアカードは固定装飾なのでfill/stroke/fontSize/cornerRadius等を出さず、UIでも無効な数値欄を非表示にする。
図形のpaddingは使わない。textのpadding:0、角丸のcornerRadius:0など有効な0は残す。
ピンはシリーズから外観を計算する。外観として有効でも、個別パーツで編集できるとは限らない。
完全自動の図形にも、縮小モードへ切り替える際の指定fontSizeを保持する。

## 確認

- 単体169件成功。種類ごとの項目、0の保持、旧データの読込、保存/Undo/接続の維持を確認。
- 実ブラウザで保存前後のSVG/Markdown描画が一致することを確認。
- UI保存、MCP保存、共有GET、図形・ピン・吹き出し・線の接合を確認。
- 古いGit保全ファイルは書き換えない。

## 道具別MCP仕様の参照先（2026-11-03）

旧ai-interfaceの道具一覧は各専用資料に整理する。属性の省略は無効な属性を見せないためのもので、有効な0や明示値を捨てるためではない。

- [線・矢印の統一と端点](connector-line-style.md)、[8点アンカー](eight-anchors.md)、[メディア接続](media-anchors.md)、[線同士の接合](connector-junctions.md)。
- [ピンの内部型・採番・表示](pin-update.md)、[付着](pin-attachments.md)、[リアクション43種類と個別設定](reactions.md)。
- [Markdown描画](markdown-preview.md)、[色と塗り透過](format-styles.md)、[文字測定](text-measure.md)、[吹き出しの3種](text-callouts.md)、[図形と文字調整](diagram-shapes.md)。
- [壁紙・不透明度・下地・原点](desk-background.md)、[独立したUIテーマ](ui-theme.md)、[定規](ruler-layout.md)、[意味単位のカード分割](help/card-splitting.md)。

現在は通常URLリンクに塗り・輪郭・文字・角丸の有効属性があるため、本資料の初期記録の「メディアは固定装飾」を全リンクへ適用しない。[リンクの表示モード](link-display-modes.md)を参照。壁紙設定UI・ピン付着・線接合は実装済み。旧資料の未実装表現や18種類のリアクション一覧は当時の記録として保持し、現行の仕様には使わない。

塗り透過は新規作成既定値0.3と、既存オブジェクトの属性省略時のスキーマ既定値1を区別する。fillOpacityは文字・輪郭の透明度を変更しない。道具ごとの適用可能な属性はsrc/object-properties.tsと各専用資料を照合する。
