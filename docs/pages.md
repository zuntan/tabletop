# GitHub Pagesで机を見る

Pages版はAI・MCPの起動を必要とせず、ブラウザで机ファイルを開けます。通常版と描画・机データ形式・基本操作を共用しています。厳密な読み取り専用ではなく、編集したものはダウンロードして持ち出せます。

## URLで机を指定する

公開後の例：

```text
https://zuntan.github.io/tabletop/?desk=desks/guide.tabletop
```

`desk` はアプリのURLを基準にした相対参照、またはHTTP(S)の完全なURLです。URLに `&` などが含まれる場合は、値全体をURLエンコードしてください。

別プロダクトも同じ `https://zuntan.github.io` に置かれていれば、例えば次のような指定ができます。

```text
https://zuntan.github.io/tabletop/?desk=%2Fother-product%2Fguide.tabletop
```

別ドメインのファイルは配信元のCORS許可が必要です。HTTPSのページから通常のHTTP配信元を読むことはブラウザに制限されます。まず自身のGitHub Pages上の資料を扱う用途を想定しています。

URL指定がなければ空の机が開き、「ファイル → アップロード」で手元の `.tabletop` を読み込めます。

## 通常版との違い

接続・接続状態・LED・ひとりで考える・ベル・AI指差し解除は表示せず、AIへの自動接続も行いません。サーバー保存のSAVE／SAVE AS／LOAD・サーバーの履歴・机リンク追加は非表示です。アップロード・ダウンロード・PDFは残します。

机リンクはHTTP(S)のURLや、開いている机ファイルからの相対URLを使えます。通常版で使っていたPC内の絶対パスはPagesから開けません。外部画像やWeb資料は、その配信元への通信が必要です。完全な無通信動作やオフラインキャッシュを提供するものではありません。

机を切り替える際に未保存の編集があれば、共通の確認画面を使います。「保存」はダウンロードになり、公開済みの原本は変更しません。

## ビルドと確認

```bash
npm ci
npm run build:pages
npm run preview:pages
```

通常版の出力は `dist/`、Pages版は `dist-pages/` です。生成物はGitへコミットしません。プレビューのURLをブラウザで開きます（標準は `http://127.0.0.1:4173/`）。HTMLファイルの直開きは使いません。

`docs/tabletop/` の `.tabletop` だけが `dist-pages/desks/` へコピーされます。サブディレクトリも維持します。開発用の `docs_devel/desk-snapshots/` は公開物に含めません。公開する机の内容は、配置前に確認してください。

## GitHub側の初回設定

リポジトリの Settings → Pages → Build and deployment → Source を **GitHub Actions** にします。

`.github/workflows/pages.yml` がmainへの関連ファイルのpushで実行され、ビルドした `dist-pages/` だけを公開します。初回設定前の実行が失敗していた場合は、Actionsの「Deploy Tabletop Pages」から手動でRun workflowできます。

最初に公開して開く机は後から指定できます。アプリの公開だけでは、開発机が自動で読み込まれることはありません。
