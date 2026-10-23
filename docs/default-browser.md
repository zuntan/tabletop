# OS標準ブラウザで机を開く

2026-10-20。`open` 11.0.4を使用し、Windows・macOS・Linuxの標準ブラウザ起動をライブラリへ委ねる。Chrome DevTools MCPは必須ではない。

## 接続なしの机を開く

`desk_browser_open({mode:"standalone"})`で、人間だけが使う空の机を開けます。ペアリング受付・接続解放は不要で、既存のAI接続を維持します。起動URLはサーバー自身の `/?connect=off`、トークンやペアリング情報は付けません。アップロード／ダウンロードで単独利用でき、AIの道具は引き続き元の接続中の机を操作します。通常SAVE／LOADは接続が必要です。閉じるのは利用者に任せます。

## 接続ありのMCP起動

1. 新規／手動接続として `desk_pairing_open({confirm:true})` で受付を開く。
2. `desk_browser_open()` で、MCPサーバーが動作しているOSの標準ブラウザへTabletopのローカルURLを渡す。
3. `desk_connection_info` の `browserConnected:true` を確認し、`desk_pairing_info` を非公開で保持する。
4. 必要なら保存した机を通常の手順でロードする。起動ツールはロードしない。

接続ありの起動では、接続中の机がある場合は拒否する。明示的な机の切替では、先に保存と `desk_release` を行う。再起動後に既存タブが残る場合は `desk_pairing_restore` を使い、不要な新規ペアリングをしない。

受付中は繰り返し起動を要求できる。複数タブ／ウィンドウが開くことがあり、閉じる操作はユーザーに任せる。OSの起動要求が成功しても、ブラウザ表示や接続の成功は保証しない。開けない場合は `desk_connection_info` のURLを手動で開く。自動再試行はしない。

起動先はサーバー自身が生成したURLのみ。任意URL・アプリ指定やシェルコマンドは受け付けない。設定済みトークンもサーバー内でURLに付与してブラウザへ渡し、ツール結果・エラーメッセージへは出力しない。LAN設定は変更しない。

リモート／GUIなしのサーバーは、手元のOSのブラウザを開く仕組みにはならない。WSLのWindows側起動はライブラリの環境判定に委ねる。対応OSすべてでの実機検証は未実施。

`open`はMITライセンス。https://github.com/sindresorhus/open

## Codexから起動するLinuxデスクトップ

CodexのMCP子プロセスへGUI環境が自動で渡らない場合がある。起動側には値があるのにMCP側にはない場合、ユーザー設定の既存`[mcp_servers.tabletop]`へ次を追加し、MCPを再起動する。

```toml
env_vars = ["DISPLAY", "WAYLAND_DISPLAY", "XDG_RUNTIME_DIR", "DBUS_SESSION_BUS_ADDRESS", "XDG_CURRENT_DESKTOP"]
```

値を固定せず、Codex起動側の現在値を引き継ぐ。GUI環境そのものがないサーバーでは、この設定だけで手元のブラウザを開けるようにはならない。

起動プロセスは最大1.5秒だけ観察し、直後の異常終了をツールのエラーとして返す。ブラウザ自体が閉じるまでは待たない。その後の成功判定は机の接続確認で行う。

## 実機確認

2026-10-20、Ubuntu/GNOMEでCodexのGUI環境引き継ぎを設定後、desk_browser_openによるChrome標準ブラウザ起動、MCP接続、145パーツの机の復元に成功。DevTools経由のブラウザは使用していない。UIテーマはブラウザごとのローカル記憶のため、以前の開発用ブラウザのダーク設定は引き継がずライトで表示された。
