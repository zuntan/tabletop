# AIの机参照と画像入出力

2026-11-03。旧ai-interface資料をsrc/desk-context.ts、model.ts、asset-tools.ts、assets.tsと照合して移管。全ての机別ツールにdeskIdを指定する。

## 最初の読み取り

`desk_context`は一回の応答でsessionId・revision・選択・AI指差し・パーツ情報・接続・設定・ピンのメンバーと履歴を取得する。埋込画像本体は含めない。limitは履歴の件数（既定100、最大200）であり、オブジェクト数を制限する引数ではない。履歴が続く場合はhistory.hasMoreとhistory.nextRevisionを使う。一回の整合した参照は、その後の文書をロックするものではない。

画像の表示矩形は[imageGeometry](image-geometry.md)を参照。読み込み完了はrevisionを変えない場合がある。画像込みの全状態が必要な場合だけdesk_stateを使い、通常はcontextや個別取得から始める。新規机のグリッドは96／4:1（実刻み24）で、旧ファイルの補完値とは区別する。[共通スナップ](shared-snap.md)を参照。

## 読み取りと一時出力

`desk_asset_read({deskId,id})`は埋込画像・SVGを読む。ラスター画像はメタデータのtextブロックとMCP imageブロック、SVGはJSONのsvgソースを返す。Mermaid・QR・QR表示のリンクはブラウザで現在の原文からSVGを生成する。外部URLの画像をサーバーから取得する機能ではない。

exportFile:trueならサーバー側の一時ファイルも出力する。OS一時領域のtabletop-assets-*ディレクトリ（0700）にランダム名で排他作成し、ファイルは0600。出力合計はサーバープロセス当たり100,000,000 bytes。自動削除はせず、必要な受け渡し後に利用者が削除する。サーバーとAIの実行環境でファイルシステムを共有する必要がある。

## 取り込み・差し替え

`desk_asset_import`のsourceはpath・svg・dataUrlのどれか一つ。素材1点10,000,000 bytesまで。ファイル名の拡張子ではなく内容を判別し、SVGは単独文書・名前空間を検証してDOCTYPE／ENTITYを拒否する。画像デコードの完全性はここでは検証せず、表示はブラウザへ委ねる。

pathはTABLETOP_ASSET_ROOT以下の絶対パス（既定はOS一時領域）。実パスを検証し、許可外へ出るシンボリックリンクや通常ファイル以外を拒否する。信頼されたMCPクライアント用のローカル読取機能。

mode:addが既定。IDは一意、寸法の省略値は480×354（タイトル34を含む）。追加時のsnap:deskは現在のスナップで位置・対象寸法を補正するため、実結果はplacement.resultsで確認する。asProp:trueはSVG小物を作り、アンカーや任意リンクを持たない。

mode:replaceではsrcだけを変更し、ID・型・位置・寸法・タイトル・リンクを保持する。差し替え時のgeometry・title・url・asProp指定は拒否する。対象を確認したrevisionをガードし、同じ一回のUndoへまとめる。AIはexpectedRevisionを指定し、結果不明の切断・タイムアウト時は即再送せず対象・revision・履歴を照合する。

## 保存・出力との分担

机の保存／読込は[MCP保存・読込](mcp-save-load.md)、現行容量上限・分割転送は[共通転送](binary-transfer.md)。任意の絶対保存パス・日本語名・明示上書きは現在対応済みで、旧資料の禁止事項を転記しない。矩形からの画像生成は[カメラ](capture-camera.md)、PDFは[AI用PDF出力](ai-pdf-export.md)。一般取得・保存の有効属性は[意味のあるプロパティ](meaningful-properties.md)を参照する。
