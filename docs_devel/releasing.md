# リリース用ソースZIPの生成

2026-11-03。配布は `tabletop-X.Y.Z.zip` とその `.sha256`。タグ時点のGit管理ファイルに `release-info.json` を加え、一つの `tabletop-X.Y.Z/` フォルダーへまとめる。node_modulesやdist、未追跡ファイルは入らない。docs_develはAI向けヘルプを含むため文章を維持するが、desk-snapshotsと作業用.tabletop、生成物のoutputは配布から除外する。docs/tabletopの公開用机は同梱する。

## 自動処理

`.github/workflows/release.yml` はvで始まるタグのpushで起動し、厳密な `vX.Y.Z` 以外は生成スクリプトが拒否する。タグ先とcheckoutのHEAD、タグとpackage.jsonのversionが一致することを確認する。実行時の作業ツリーからではなく `git archive` でタグ先の内容を取得する。アーカイブは一時ファイルへ出力し、子プロセスの標準出力バッファ制限には依存しない。

配布ZIPのrelease-info.jsonにはversion・tag・40桁のcommitを保存する。ビルドはGitを優先し、Git情報がない場合にだけ、versionとtagを検証した同梱情報の先頭7桁を使う。GitHub自動生成のSource codeにはこの追加情報がないため、通常どおりハッシュを省略する。

ZIPをGitのない一時フォルダーへ展開し、npm ci、通常版／Pages版ビルド、npm testとハッシュ取得を確認する。その後、GitHub Releaseを**下書き**で作り、ZIPとSHA-256を添付する。公開は自動化しない。公開済みReleaseは変更せず停止し、既存の下書き添付は同一内容なら維持、異なる場合は削除・上書きせず停止する。

## 公開するまで

1. package.jsonのバージョン、INSTALL・README・既知の制限を確認する。
2. 配布処理を含む最終コミットを確定し、そのコミットへvX.Y.Zタグを付けてpushする。
3. Actionsの成功と下書きの添付を確認する。
4. ZIPからの初回接続、カード作成、保存・読込を確認し、リリースノートを整える。0.1.0の原稿は `docs_devel/releases/0.1.0.md`。下書きReleaseの自動生成本文を、この原稿に差し替えてから公開する。
5. 人間が確認した後にReleaseを公開する。公開済みのタグを動かさず、修正は次のバージョンとする。

タグ付け・push・外部公開は別作業。スクリプトのローカル検証だけでは、GitHubの権限設定や実際のActions成功を確認したことにはならない。SHA-256は配布ファイルの照合用で、署名ではない。

関連実装：scripts/package-release.mjs、scripts/draft-release.mjs、scripts/build-info.mjs。検証：tests/release-package.test.ts、tests/draft-release.test.ts。

根拠：[GitHub Release REST API](https://docs.github.com/en/rest/releases/releases)、[Releaseの管理](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)。

## 再開メモ（2026-11-04）

0.1.0公開準備の工程①〜④は完了。2026-11-04に⑤の最終差分確認を実施し、この記録を含む変更をmainへコミット・pushする。再開時は `git status` と `git log origin/main..HEAD --oneline` で保存・送信状態を確認し、未送信がなければ**⑥のv0.1.0タグ作成・push**へ進む。タグ付け・タグpush・Release公開はまだ行っていない。自動化はローカル検証済みだが、GitHub上の実行確認は⑥以降で行う。

- 検証結果：`docs_devel/releases/0.1.0-verification.md`。
- リリースノート原稿：`docs_devel/releases/0.1.0.md`。
- 一時工程表：`/tmp/tabletop-release-plan.tabletop`。必要なら別机に読み込む。/tmpのファイルが残っていなくても、この記録と検証報告を基に再開できる。
- 依存更新後：監査0件、Node.js 22.12／24.22で単体322件、選定ブラウザ18件、通常版／Pages版ビルド成功。未指定項目を維持するZod 4移行修正を含む。
- ⑤の確認：差分・新規ファイル・ライセンス通知の整合を確認し、作業用ファイルと既知の認証情報形式の混入がないことを点検した。競合するリモートmainの更新はなし。
- 次の工程：⑥v0.1.0タグpush・下書きRelease生成 → ⑦添付された配布ZIP自体の確認・本文整備 → ⑧公開・公開後確認。
- これらは再開位置の記録であり、今回の記録追記だけでコミット・タグ付け・公開を実行しない。

## 0.1.0リリース後のブランチ運用方針

利用者との相談では、0.1.0リリース完了後に、その時点のmainからdevelopを作成し、以後の普段の開発をdevelopへ移す方針とした。ブランチの作成・切替はまだ行っていない。

- develop：普段の実装・コミット・push先。
- main：公開する状態を置く。現在のPages自動更新もmainを対象とする。
- 次版を公開するとき：developで確認した変更をmainへマージし、mainの確定コミットへリリースタグを付ける。
- 緊急修正をmainで行った場合：developにもその変更を取り込む。
- 公開済みタグは動かさず、修正は新しいバージョンにする。

現段階では細かな追加ブランチ規則は設けない。まず0.1.0のリリースを完了してから、この運用へ移行する。

## ⑥の初回実行と修正待ち（2026-11-04）

v0.1.0タグを7044259へ付けてpushした。Pagesのmain更新は成功したが、[初回Release Actions](https://github.com/zuntan/tabletop/actions/runs/41756756010)はZIP生成でgitの標準出力上限128MiBを超え、ENOBUFSで失敗した。Releaseはまだ作成されていない。

配布元の管理ファイルは約303MBで、そのうちdocs_develが約283MB。修正案では過去のdesk-snapshots・docs_devel内の作業用.tabletop・outputを配布だけから除外し、Gitアーカイブを一時ファイルへ出力する。リポジトリの元ファイルは保持する。公開用机とAIヘルプは配布に残す。

修正後のパッケージテスト成功。実際のv0.1.0タグの内容を修正済みスクリプトで包装し、ZIP約14.71MB／展開後約20.17MB、973エントリー、全AIヘルプ・公開机・コミット情報・SHA-256を確認した。一時成果物は `/tmp/tabletop-release-package-fixed/`。これは修正済みスクリプトを含む正式配布物ではなく、生成処理の確認用。

2026-11-04、利用者から未公開v0.1.0タグの付け直しを明示的に許可された。修正をコミット・mainへpushし、この修正コミットへタグを移して再実行する。以後の再開時はGitHub Actionsと下書きReleaseの実際の状態を確認する。今回の許可は、この未公開タグの修正に対する例外であり、公開済みタグを動かさない方針は維持する。
