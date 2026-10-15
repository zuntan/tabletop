# Windows＋GitHub Copilot CLI

Windows上のCopilot CLIからstdio MCPでTabletopを起動し、同じWindowsのブラウザーで操作する手順です。WSLは必須ではありません。

## 前提

- Node.js 22.12以降（新規導入にはNode.js 24 LTSを推奨）とnpm。
- PowerShell 7を推奨。Copilot CLI公式の要件はPowerShell 6以降です。
- 利用可能なGitHub Copilotアカウント。組織で利用する場合はCLIの利用が許可されていること。
- EdgeやChromeなどのブラウザー。

この手順はコードと公式仕様に基づくものです。Windows実機・Copilot CLIでの接続、画像入出力、終了処理は未検証です。Windows用パスの単体テストはLinux上でも実行できますが、実機検証の代わりにはなりません。

## 1. Tabletopを準備

リポジトリをWindowsへcloneまたは展開します。以下は `C:\dev\tabletop` に配置した例です。Linuxの `node_modules` はコピーせず、Windowsで依存関係をインストールしてください。

PowerShellで実行します。

```powershell
Set-Location C:\dev\tabletop
node --version
npm.cmd ci
npm.cmd run build
```

`npm.cmd` を明示すると、PowerShellの実行ポリシーによって `npm.ps1` が拒否される問題を避けられます。実行ポリシーを緩める必要はありません。

## 2. Copilot CLIを準備

未インストールの場合は、公式手順に従って導入します。

```powershell
winget install GitHub.Copilot
```

インストール後、新しいPowerShellを開き、`copilot` を起動して認証します。Tabletop用のNode.jsも、新しいターミナルで `node --version` が成功することを確認してください。

## 3. MCPサーバーを登録

Copilot CLIの `/mcp add` でローカル（stdio）サーバーを追加できます。設定ファイルで登録する場合は、ユーザーの `.copilot/mcp-config.json`（通常 `C:\Users\ユーザー名\.copilot\mcp-config.json`）の `mcpServers` に次のエントリーを追加します。既存の設定は上書きせず、`tabletop` を追記してください。

```json
{
  "mcpServers": {
    "tabletop": {
      "type": "stdio",
      "command": "node",
      "args": ["--import", "tsx", "src/server.ts"],
      "cwd": "C:/dev/tabletop"
    }
  }
}
```

- `cwd` は自分の配置先の絶対パスに変更します。これによりCopilot CLIを別のディレクトリから起動しても、Tabletop側で `tsx` とサーバーを解決できます。
- JSON内ではパスを `/` 区切りで書けます。`\` を使う場合は `\\` とエスケープしてください。
- `node` が見つからない場合は、`command` にNode.js実行ファイルの絶対パス（例：`C:/Program Files/nodejs/node.exe`）を指定してください。値の中に追加の引用符は不要です。
- Windowsのドライブパスを `--import` に直接渡す例は避けています。絶対パスでローダーを指定する場合、Node.jsのESM仕様に合わせた `file:///C:/...` URLが必要です。
- 設定後はCopilot CLIを再起動するか、対応バージョンで `/mcp reload` を実行します。`/mcp` でサーバーの状態を確認してください。
- この構成はstdioです。`http://127.0.0.1:4317` は人間向け画面であり、HTTP MCPの接続先ではありません。

## 4. ブラウザーで接続

Copilot CLIへ、例えば次のように依頼します。

> Tabletopの新しい机を開きたいので、desk_pairing_openで初回受付を開き、desk_connection_infoで接続URLを教えてください。接続後はdesk_pairing_infoの復帰情報を非公開で保持してください。

サーバー再起動後は保持したrecordを `desk_pairing_restore` に渡し、既存タブの自動復帰を待ちます。新規受付を勝手に開き直さず、情報を失った場合は保存・手動接続を案内します。[接続復帰](./connection-recovery.md) に手順と旧版更新時の注意をまとめています。

返されたURLをブラウザーで開きます。通常は `http://127.0.0.1:4317/` に一時トークン付きフラグメントが付いたURLです。トークンを含むURLは秘密情報のため、公開チャットやスクリーンショットには載せないでください。

接続後の動作確認例：

> Tabletopの状態を確認して、「Windows接続テスト」というメモを1枚追加してください。

Copilot CLIがサーバーを起動するので、別途 `npm start` は実行しません。同じポートで手動起動済みなら、そのターミナルでCtrl+Cを押して停止してから接続します。別のTabletopインスタンスを使う場合は、MCP設定の `env` に別の `TABLETOP_PORT` を指定してください。

作業机タブは1サーバーにつき1つです。状態はタブのメモリ内だけに保持されるため、再読み込み・タブ終了で失われます。

## 画像ファイルと一時フォルダー

画像の手動追加はブラウザーのファイル選択・ドロップを利用できます。AIからローカルファイルを取り込む `desk_asset_import` は、既定ではNode.jsの `os.tmpdir()` が返すOS一時フォルダー内だけを読み込みます。Windowsでは通常ユーザーのTempフォルダーですが、環境変数などによって変わります。

専用フォルダーを使う場合は、実在するディレクトリを作り、MCP設定の `tabletop` エントリーに例えば次を追加します。

```json
"env": {
  "TABLETOP_ASSET_ROOT": "C:/dev/tabletop-assets"
}
```

取り込み元はこのディレクトリの配下に限定してください。ドライブ全体やユーザーフォルダー全体を許可することは推奨しません。`desk_asset_read` の一時出力先は引き続きOS一時フォルダーで、取り込みルートとは別です。

WindowsではUnixの0600・0700と同じ権限保証はありません。機密画像を扱う場合はWindows側のアクセス権（ACL）を確認してください。MCPツール説明の `/tmp` 表記はUnix向けで、実装はOS一時フォルダーを使用します。

## 開発テストの注意

一部の既存E2EテストはLinuxのChromeパスを既定値にしています。Windowsでは実際のブラウザー実行ファイルを指定してください。以下はEdgeの一般的な配置例です。配置が異なる場合は変更します。

```powershell
$env:TABLETOP_CHROME = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
npm.cmd run test:e2e
```

Unix権限ビットの厳密一致やシンボリックリンクを使う既存テストもあり、Windows上のテスト全体の成功はまだ保証していません。シンボリックリンク作成のためだけに管理者実行することは推奨しません。

## 参照

- [GitHub Copilot CLI公式：導入・Windows要件](https://github.com/github/copilot-cli#readme)
- [GitHub Copilot CLI公式：MCP設定](https://github.com/github/copilot-cli/blob/main/_autodocs/types.md)
- [Node.js：path](https://nodejs.org/api/path.html)
- [Node.js：os.tmpdir](https://nodejs.org/api/os.html#ostmpdir)
- [Node.js：Windowsのファイル権限の制限](https://nodejs.org/api/fs.html)
