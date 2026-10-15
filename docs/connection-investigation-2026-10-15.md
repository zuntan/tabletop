# 接続問題の再調査（2026-10-15）

## 結論

**その後の合意では、サーバー停止を許容し、既知の机との安全な復帰を設計する方針となった。** 常駐化を優先する当初案は採用せず、ホスト設定は変更しない。現在の合意は [接続復帰の設計整理](./connection-recovery-design.md) を参照。以下は原因調査と、その時点での提案を残した記録。認証の具体方式は未決定で、復帰機能はまだ実装していない。

現在の設定とコードから、以下の経路が成立することを確認した。隔離ブラウザではサーバー再起動以降の挙動も再現した。ただし、過去の個々の切断について終了時のログはなく、すべて同じ原因だったと断定はしない。

```text
MCP呼出しが約10分途絶える
→ MCPホストがstdioサーバーを停止
→ 同じプロセスのHTTP／WebSocketも停止
→ ブラウザは古いトークンで3秒ごとに再接続
→ 次のMCP呼出しでサーバーが起動し、新しいランダムトークンを生成
→ 古いトークンの接続は403となり、そのままでは復帰しない
```

## 調査範囲と机の保護

- ライブ机は86個、ピン4本。調査前に `connection-investigation-before-2026-10-15-01.tabletop` として保存した。
- ライブサーバーの停止、ブラウザ再読込、設定変更、文書編集は行っていない。
- 製品コードの修正はまだ行わず、隔離ポートでの特性確認テストだけを追加した。
- 接続トークンや他サーバーの設定値は本報告に含めない。

## 確認できたこと

### 1. MCPホストのライフサイクル設定

この環境のpi-mcp-adapterは5.3.0。Tabletopの設定には `lifecycle`／`idleTimeout`／固定 `TABLETOP_TOKEN` がない。グローバルのidleTimeout指定もない。

インストール済みの公式説明・実装を照合した。

- 既定は `lazy`、idleTimeoutは10分。チェックは30秒間隔で、停止時刻は厳密な10分ではない。
- 実行中のMCP呼出し等は停止を抑止するが、Tabletop独自のブラウザWebSocket通信や人間の机上操作は、そのMCP利用時刻を更新しない。
- stdio接続を閉じるとローカル子プロセスも終了する。
- `lazy-keep-alive` またはサーバー個別の `idleTimeout: 0` が常駐用途向けに用意されている。

インストール済みadapterの `McpLifecycleManager` と `McpServerManager.isIdle` を使い、最終利用時刻だけを601秒前とした模擬検証も実施。既定設定ではcloseを呼び、個別idleTimeout=0では呼ばないことを確認した。ライブプロセスや実際の時刻は操作していない。10分以上の実時間待機試験はしていない。

根拠：adapterの `docs/configuration.md` のLifecycle Modes／How idle shutdown works、`init.ts`、`dist/lifecycle.js`、`dist/server-manager.js`。これはホスト固有の設定であり、すべてのMCPクライアント共通の仕様ではない。

### 2. Tabletopサーバー側

`src/server.ts`：

- ランダムトークンは起動時に生成する。再起動後は通常変わる。
- 認証・Origin・Host・パスの不一致をHTTP 403で拒否する。
- 同時接続は1ブラウザまで。他の接続は409。
- stdin終了、SIGINT、SIGTERMでshutdownし、ブラウザ接続も閉じる。
- WebSocket自身のアイドル切断タイマーはない。heartbeatもない。
- 応答待ちの10秒タイマーはMCP要求単位であり、アイドル切断ではない。期限超過時は結果不明を返し、自動再送はしない。
- 現在のログには接続開始はあるが、切断code／reason／時刻やshutdown起因の十分な記録がない。

### 3. ブラウザ側

`src/main.ts` のconnect：

- 切断後は同じトークンで3秒ごとに再接続する。新しいトークンを取得する仕組みはない。
- 正常な再接続成功ではフッターの赤表示を解除する。成功後も必ず赤が残るという不具合は、今回の試験では再現しなかった。
- 一方、oncloseは接続ラベルだけを変更し、フッターの古い成功メッセージを消さない。切断中でも「AIと共有できる状態です」が残ることを再現した。
- 接続試行開始時もフッターを更新しないため、前回のエラーと「接続中」が同居できる。単に赤が見えるだけでは、新しい試行の失敗と区別できない。
- closeイベントのcode／reason／wasCleanを利用していない。errorイベントから403と409を直接区別する実装もない。
- 机の正本はブラウザ内。サーバー再起動と再接続だけでは文書を消さない。ただし、未保存のままタブを再読込すれば失うので、それを復帰手順にしてはいけない。

## 隔離ブラウザ試験

`tests/connection-investigation.e2e.ts` は現状の挙動を記録する特性確認テスト。修正時には、意図的に記録した古い表示の期待値も更新すること。

| 条件 | 結果 |
| --- | --- |
| 生成トークンで接続後、stdioサーバー停止・再起動 | トークンが変わり、ブラウザの自動再接続は失敗 |
| 新トークンを接続フォームへ入力 | タブ再読込なしで復帰。sessionId・revision・オブジェクトを保持 |
| 固定トークンで同様に停止・再起動 | 自動再接続で復帰。sessionId・revision・オブジェクトを保持 |
| 接続成功後にサーバー停止 | 「未接続」と古いフッター成功文が同居 |
| 再接続成功 | フッターのエラー状態は解除 |

固定トークンの試験は現行の挙動の比較。後の合意では、固定・生成のどちらでも同じペアリング確認を行う方針となった。現行実装にその確認はない。ランダムトークンを公開HTTP経由で配布するなどの認証緩和はしない。

## 調査時の提案（後の議論で変更・未実施）

1. **優先・小規模：この環境のTabletopだけ常駐させる。** `lifecycle: "lazy-keep-alive"`、または個別 `idleTimeout: 0`。他のMCPサーバーやグローバル設定には広げない。設定の再読込に伴う停止・トークン変更があり得るので、保存と再接続をセットで実施する。設定変更自体は利用者の了承後。
2. **次の製品修正：表示と診断の整備。** 接続試行／成功／切断／再接続待ちで表示を揃える。安全な切断情報とサーバー起動・終了理由を残す。トークン、完全な接続URL、文書本文をログへ出さない。ブラウザのgeneric errorから認証失敗を断定しない。
3. **必要性を再評価：死んだ接続の検出。** 常駐化後もサーバー生存中に切れる、接続枠が解放されない等がある場合、ping／pong等を検討する。heartbeatではホストによるプロセス終了やトークン変更を防げない。

現時点の試験ではサーバー再起動だけによる文書消失は確認されていない。ただし、切断の瞬間に実行中だった編集要求は結果不明になり得る。再試行前にsession／revisionと実内容を確認する現行方針を維持し、編集要求の自動リプレイは追加しない。

## 仕様の根拠

Context7で以下の公式ドキュメントを確認した。

- [ws: How to detect and close broken connections](https://github.com/websockets/ws#how-to-detect-and-close-broken-connections)：ping／pongは応答しない接続を検出するもの。
- [ws: Client authentication](https://github.com/websockets/ws#client-authentication)：HTTP upgrade段階で拒否できる。
- [MDN: WebSocket error event](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/error_event)：errorはgeneric Event。
- [MDN: CloseEvent](https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent)：code／reason／wasClean。
- [pi-mcp-adapter: configuration](https://github.com/nicobailon/pi-mcp-adapter/blob/main/docs/configuration.md)：公開資料は更新され得るため、今回の判断にはインストール済み5.3.0の同文書と実装も照合した。
