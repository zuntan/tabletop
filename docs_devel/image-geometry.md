# 画像座標メタデータ

## 対象

新版ブラウザの `desk_context.objects`・`desk_list.objects`・`desk_get` は、画像／SVGに読取専用の `imageGeometry` を追加する。画像内部への指差し・ピンの自動接続・スナップ・カメラ操作は今回の対象外。

```json
{
  "status": "ready",
  "coordinateSpace": "world",
  "fit": "xMidYMid meet",
  "naturalUnit": "intrinsic-css-px",
  "natural": { "width": 800, "height": 400 },
  "cardRect": { "x": 10, "y": 20, "width": 400, "height": 334 },
  "viewportRect": { "x": 10, "y": 54, "width": 400, "height": 300 },
  "renderedRect": { "x": 10, "y": 104, "width": 400, "height": 200 }
}
```

- `cardRect` はカード枠。`viewportRect` はタイトル34 world unitsを除いた画像領域。
- `renderedRect` は縦横比を維持し中央配置した画像全体の矩形。透明画素や画像ファイル自体に含まれる余白を除いた、可視画素の輪郭ではない。ストローク、影、選択枠も含めない。
- `natural` はブラウザの `naturalWidth`／`naturalHeight`。CSS pxでの密度補正済み自然寸法であり、ファイルに符号化された生の画素数を保証する値ではない。
- カードと表示矩形はカメラ・ズームに依存しないworld座標。移動・サイズ変更後は最新のカードから再計算する。

## 座標変換

`status: ready` かつ `renderedRect` と `natural` が存在するときだけ利用する。画像左上を0、右下を1とする正規化座標 `(u, v)` は次の式で変換できる。

```text
worldX = renderedRect.x + u * renderedRect.width
worldY = renderedRect.y + v * renderedRect.height
u = (worldX - renderedRect.x) / renderedRect.width
v = (worldY - renderedRect.y) / renderedRect.height
intrinsicX = u * natural.width
intrinsicY = v * natural.height
```

百分率は100で割ってu／vにする。u／vが0〜1の外なら画像矩形外であり、カード内でも余白やタイトルを画像内と扱わない。境界座標のため右下はwidth／heightに一致し、整数画素インデックスとは区別する。

## 読込状態と制限

- `ready`：埋め込みPNG／JPEG／GIF／WebPのデコード済み寸法から計算可能。
- `unobserved`／`loading`：観測前／読込中。再取得する。
- `error`：読込失敗、または自然寸法なし。`renderedRect: null`。
- `not-displayed`：カードの高さが34以下で描画領域なし。`viewportRect` と `renderedRect` はnull。
- `svg-unresolved`：SVGはviewBoxのみの場合や内部の配置規則があるため、今回の計算対象外。自然寸法を取得できても画像矩形はnull。カード型がimageでもSVGのdata URLならこの扱い。
- `remote-unverified`：外部URLは実際の形式を検証しないため画像矩形はnull。ブラウザが自然寸法を取得できる場合は返すが、サーバーはURLを取得しない。

画像デコードはブラウザの非同期観測で、文書編集ではない。同じsession／revisionでもloadingからreadyへ変わり得る。状態の確定を履歴やrevision更新だけで判断しない。旧ブラウザではフィールド自体がない。読み取りツールの追加属性を `desk_execute` のobject／patchへそのまま送らない。

観測キャッシュはIDとsrcに対応し、差し替え後に古い寸法を流用しない。削除した画像のキャッシュは次の描画時に破棄する。参照結果を変更してもキャッシュを変更できない。

`.tabletop`・文書スナップショット・Undo履歴には観測値を保存しない。既存のversion 1形式を変更せず、旧ファイルもブラウザで再観測する。保存／再読込、差し替え、Undo後は状態を再取得する。自然寸法取得のためブラウザ内で画像をデコードするが、サーバー側の画像解析や外部URL取得は追加しない。

## 根拠

Context7でMDN公式ドキュメントを確認した。

- [naturalWidth](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/naturalWidth)：密度補正済みCSS px、未取得時は0。
- [naturalHeight](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/naturalHeight)
- [decode](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decode)：非同期のデコード完了と失敗。
- [preserveAspectRatio](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/preserveAspectRatio)：中央配置・縦横比維持、SVGのviewBoxとの関係。
