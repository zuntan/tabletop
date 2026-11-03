# Pages版：静的配信とURLによる机の読込

## 目的と範囲

利用者自身の別プロダクトの資料を、GitHub PagesのURL一つで開く用途から着手。通常版を別アプリへ複製せず、Viteのpagesモードと表示切替で共用する。閲覧専用の編集禁止は追加しない。

- 通常版：`npm run build` → `dist/`
- Pages版：`npm run build:pages` → `dist-pages/`
- 確認：`npm run preview:pages`（標準127.0.0.1:4173）
- 公開：`.github/workflows/pages.yml` がmainへのpushでdist-pagesだけを配信

出力先を分け、Pagesのビルドで通常版distを上書きしない。通常版のペアリングやツール仕様は変更しない。

## 実装

`runtime-mode.ts`のビルドモードでPagesを判断。CSSとサイドバー生成の設定で、接続UI・LED・ひとりで考える・ベル・指差し解除・サーバー保存UIを非表示にする。非表示タブや項目はキーボード巡回からも除外する。Pagesでは接続URL・ハッシュを渡しても自動接続を開始しない。

URLのdesk値を既存の机ファイルデコーダで読み込み、最初の自動読込では確認ダイアログを出さない。読込中の人間の編集は既存のrevision/generationガードで保護する。以後の机リンク切替は共通の未保存確認を使い、保存を選べばダウンロードする。公開ファイルの書換えは行わない。

初回の相対URLはアプリのURL基準、机リンクの相対URLは開いている机ファイルのURL基準。HTTP(S)を受け付けるが、外部ドメインのCORSや混在コンテンツ制限はブラウザに従う。認証クッキーを付けず、取得サイズは現在250,000,000 bytes上限（2026-11-03照合、[共通上限](binary-transfer.md)参照）、取得待ちは30秒。例外時に勝手に別の机へ置き換えない。

静的素材・ライセンス・消しゴム演出のURLはViteのBASE_URLを経由。相対baseでサイトのルートと/tabletop/等のサブパスへ対応する。

公開する机はdocs/tabletop内の.tabletopだけをdist-pages/desksへコピーする。開発机の保存履歴はコピーしない。現在の公開用チュートリアルはdocs/tabletop/tabletop-guide.tabletop。アプリが自動で選ぶ既定机は設けず、URL指定なしなら空の机からアップロードできる。

## 検証（2026-10-25）

- 単体全236件成功。
- 通常版とPages版のビルド・型検証成功。
- 関連ブラウザ検証：PagesのURL読込、MCP通信なし、サブパス素材、Mermaid、アップロード／ダウンロード、相対机リンク、別プロダクトの同サイト絶対URL、404、編集内容の保存後の切替。
- 通常版の保存・確認ダイアログ・SAVE AS・机の見た目・サイドバー・複数接続も検証済み。
- 公開出力のentry・.nojekyllを確認。docs_devel、node_modules、サーバーのソースは含まれない。

ローカルプレビューは起動済み。GitHubへのpushと実際のActions成功は別の確認で、環境の書込み認証・Pages設定に依存する。認証情報はリポジトリや机に保存しない。

利用・GitHub側の初回設定は [利用者向け案内](../docs/pages.md)。

## 起動オプションと初期表示（2026-11-03移管）

旧pages資料をsrc/pages-desk.ts、initial-focus.ts、main.ts、settings.ts、desk-file-controls.tsと照合。

|指定|扱い|
|---|---|
|desk|アプリURL基準の相対URL、またはHTTP(S) URLの机を起動時に読む|
|focus|空でないオブジェクトIDを初期表示に使用|
|pdf|空でない値なら机の読込後にPDFを生成して同じタブで開く。0も有効|

初期表示の優先順位は非空pdf → 非空focus → settings.initialFocusId → 通常の全体表示。focusが空なら保存済みIDを使い、指定したIDが存在しなければ選択を解除して全体表示とエラー案内に戻る。focusは存在しない場合も保存済みIDへ戻さない。

initialFocusIdはdesk_executeのinitial_view_update（targetIdにID、解除はnull）で保存・Undo対象として設定する。机の見た目では読み取り専用。通常版のLOADや起動後のアップロード・机リンク切替にはこの起動処理を適用しない。保存時の選択から勝手に登録しない。

PDF起動はMermaidとQRの描画待ちを行う。待機期限と文書の世代・revisionのガードを持ち、読込・生成に失敗した場合は机上へエラーを出す。pdfを外して元URLを開けば通常の机へ戻れる。通常表示ではファイルメニューからPDFとPNGを開ける。非空pngを起動オプションとして扱う実装はない。

通常版のconnect=offは自動接続を抑止する指定で、Pagesでは常に自動接続しないため不要。newDeskNameは空の机の起動名であり、読込対象の名称や初期表示を指定するものではない。

## ビルド・配信の現行構成（2026-11-03）

package.json、vite.config.ts、scripts/prepare-pages.mjs、.github/workflows/pages.ymlを照合。

```bash
npm ci
npm run build:pages
npm run preview:pages
```

build:pagesはライセンス生成・型検証・Viteのpagesモード・公開机の準備を順に行う。相対baseとdist-pages出力を使い、通常版distと分離する。previewはHTTP経由で確認し、index.htmlの直開きで代用しない。両出力ディレクトリは.gitignore対象。

GitHubのSourceはGitHub Actionsへ設定する。workflowはmainへの関連パスのpushとworkflow_dispatchで起動する。対象はsrc・public・scripts・docs/tabletop・package*.json・index.html・tsconfig.json・vite.config.ts・workflow自身。docs_develの文章変更だけでは自動配信しない。Node 22でnpm ciとbuild:pagesを行い、dist-pagesだけをPages artifactとしてアップロード・配信する。実際の公開成功はActions結果を別途確認する。

## 公開用机とPDFの配置（2026-11-03）

prepare-pagesはdocs/tabletopを再帰的に調べ、隠し項目を除いた通常ファイルのうち、拡張子が.tabletopのものだけをdist-pages/desksへコピーする。階層を維持し、.nojekyllを出力する。公開対象の個別許可リストではないため、このディレクトリへ机を追加すれば配信対象になる。配置前に内容を確認する。開発スナップショットはこの処理に含めない。

現在の案内対象は `?desk=desks/tabletop-guide.tabletop`。同名PDFはdocs/tabletop/tabletop-guide.pdfに保管しているが、この処理ではPDFをdesksへコピーしない。Git上の保管とPagesでの配信を区別する。circle.pdfも同様。サンプル追加前の机はdocs_devel/desk-snapshots/circle-before-samples.tabletopに保管する。これらの所在を確認済みで、内容の再生成・移動はしていない。

旧READMEの774パーツという値は当時の記録として扱い、固定の現行仕様にはしない。利用者向け資料の下書きは机上に保持し、今回docs/pages.md・docs/tabletop/README.mdには書き戻していない。

関連試験はtests/pages-desk.test.ts、initial-focus.test.ts、pages-viewer.e2e.ts、initial-focus.e2e.ts。今回は実装と設定・資料の照合を行い、これらの動作試験やビルドは再実行していない。
