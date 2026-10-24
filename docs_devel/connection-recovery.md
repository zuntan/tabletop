# 接続とペアリングによる復帰

複数机対応後の仕様です。[複数接続](./multiple-desk-connections.md)、[内容保護レビュー](./connection-data-safety-review.md)、過去の[設計議論](./connection-recovery-design.md)も参照してください。古い調査・作業記録の単一接続制約は現行仕様ではありません。

## 新しい机を接続する

1. 利用者の新規起動／手動再ペアリングの意図を確認する。
2. `desk_pairing_open({confirm:true})` で追加受付を開く。既存の接続・ペアリングは残る。
3. `desk_connection_info` のURLを案内するか、`desk_browser_open({mode:"connected"})` でOSブラウザを開く。
4. `desk_connections()` で追加先のdeskIdとconnected:trueを確認する。既存机のbrowserConnected:trueを新規接続の成功と見なさない。
5. `desk_pairing_info({deskId})` の秘密recordを机別に非公開の継続コンテキストへ保持する。引継ぎでも残す。
6. `desk_summary({deskId})`／`desk_context({deskId})` で実内容を読む。

サーバー起動直後は受付も復帰先も未設定です。`desk_connection_info` は参照だけで受付を開きません。受付は一回の新規ペアリング完了で閉じます。追加するたびopenします。接続済み机数の製品上の制限はありません。

全ての個別ツールにdeskIdが必要です。カレント机はありません。机名・色・会話の代名詞はAIの判断材料で、名前による自動ルーティングはしません。

## 接続情報の読み方

| 状態 | 次の操作 |
| --- | --- |
| waiting-for-AI | 新規／手動接続ならopen、復旧なら保持したrecordをrestore |
| new-pairing-open / bootstrapReady:true | 追加受付中。URLを開き、一覧で新しい接続を確認 |
| paired / 接続なし | 登録済みペアの復帰待ち。自動でopenしない |
| 接続あり | desk_connectionsから操作対象を選び、秘密recordを机別に保持 |

`browserConnected` は1台以上接続していること、`connectionCount` は接続数です。個別状態は一覧で確認します。切断済み登録も一覧に残り、最後に取得できた名前・配色は古い場合があります。一覧取得はベルを受領済みにしません。

`TABLETOP_TOKEN` 未指定時は128ビット乱数・base64urlの22文字の初回URLを返します。env指定時は設定済みトークンを開示しません。利用者がURLの `#token=` にURLエンコードして付けます。URLは秘密で、復帰record・公開deskIdとは別物です。

## 再起動から復帰する

1. 各机の秘密recordを `desk_pairing_restore({pairing})` へ渡す。他の机を置き換えない。
2. ブラウザの再試行を数秒待ち、desk_connectionsで対象の接続を確認する。
3. そのdeskIdでsessionId・revision・実内容を読み直す。

復帰のためにopenや新規ブラウザ起動で代用しません。登録前のブラウザは静かに待機します。誤った秘密による証明は拒否します。同じrecordを切断時に再登録できますが、接続中の同じペアへのrestoreは拒否します。別の机の接続中でも復旧できます。

切断中の人間の編集・SAVE/LOADは正常です。ペアリングは文書・revisionの一致を要求しません。要求中の切断・タイムアウトで結果不明なら実内容を確認し、自動再送しません。処理途中で別ソケットや他机へ振り替えません。

## 棚を残して接続を解放する

`desk_release({deskId,confirm:true})` は指定机だけを解放し、新規受付を開きます。他机は残ります。元のタブは「AI接続解放済み」で自動復帰を停止し、AI指示枠だけを消します。文書・履歴・人間の選択は残り、ローカル編集とアップロード／ダウンロードを続けられます。保存・読込・同期・内容移行は別操作です。

旧UI・処理中の要求／ファイル操作は拒否します。3秒以内の正しいACKがない場合は新規受付を開きません。失敗時は対象の表示と一覧を確認し、推測で再送・reloadしません。他の机の通信を巻き込んで止めません。明示解放後の旧recordを再利用せず、新しい接続のrecordを取得します。

記憶を失った場合は利用者に保存・手動接続を案内します。既存タブを勝手に再読込しません。追加openで他の机を追い出すことはありません。

## ツール

| ツール | 入力と役割 |
| --- | --- |
| desk_connections | 引数なし。公開ID・名前・配色・接続状態 |
| desk_release | deskId, confirm:true。対象の接続だけを解放 |
| desk_pairing_open | confirm:true。新しい接続の追加受付 |
| desk_pairing_info | deskId。対象ペアの秘密record。MCP限定 |
| desk_pairing_restore | pairing。対象recordを登録し復帰待ち |

pairingはpairId（UUID）、token・secret（各256ビット、64桁の小文字hex）です。全フィールドを変更せず保持します。公開deskId、sessionId、初回URLのトークンではありません。

## 認証方式と境界

具体方式は実装段階で比較し、**Web Crypto APIのHMAC-SHA-256によるチャレンジ応答**を選んだ。単純に復帰の秘密を再送する方式と比べ、毎回の乱数に証明を結び付けられ、Nodeとブラウザで標準APIを共用できるため。追加依存はない。設計議論の時点でHMAC採用が決まっていたわけではない。

- 初回はURL／手入力トークンと、既存のHost・Originチェックを使う。初回認証された接続にだけ新しいペアを提供する。
- 復帰は `/bridge?resume=1` で行う。URLに秘密を入れず、ペアIDとクライアント乱数で開始する。
- サーバーも乱数を生成し、サーバー役のHMACを返す。机はその証明を検証してから、クライアント役のHMACを返す。サーバーは検証後、接続確定用のHMACを返す。
- 証明対象はプロトコル名 `tabletop-pair-v1`、役割、ペアID、復帰token、双方の乱数を順序固定JSONで符号化したもの。役割はserver／client／readyで分ける。別の方向や接続への証明流用を防ぐ。
- HMAC-SHA256生成には `@noble/hashes` を使用。検証は利用可能なら `crypto.subtle.verify`、非セキュアHTTPでは固定長バイト比較を使う（JavaScriptの定時間保証はない）。共有秘密は初回の提供以外ではWebSocketへ送らない。
- 完全な証明の検証前には、机の接続枠もMCP要求も渡さない。固定トークンでもこのルールは同じ。

通信全体の暗号化や各文書メッセージの署名はない。HTTP／wsは初回も復帰後も暗号化されず、ペアリングでは盗聴・改ざんを防げない。既定はローカル限定で、[明示承認によるHTTP LAN試用](./http-lan.md) に対応する。LAN許可意図はAIが非公開で保持し、再起動時はその承認を復元してからペアリングを復元する。停止中の可用性はない。悪意あるプロセスのポート乗っ取り、同一origin侵害、秘密を盗んだ相手への防御は保証しない。インターネット公開・TLS・複数AI間の同期は別設計。

ペアID不一致のcloseや不正な証明を受けた机は、安全側に倒して自動復帰を停止する。その警告は「正規サーバーが相手の偽物を断定した」という意味ではなく、**相手を確認できなかった**という意味。未認証の相手により復帰を妨害され得るため、警告を根拠に秘密を再送したり、未知の相手へ自動的に再ペアリングしたりしない。

## メモリ・保存・失効

- ペアリングはサーバーと現在のタブのメモリのみ。localStorage、sessionStorage、秘密ファイルには保存しない。
- `.tabletop`、文書snapshot、履歴・Undo、`desk_state` には含めない。保存ファイルの形式version 1も変えない。
- AIがrecordを保持していれば、サーバー再起動後に復帰できる。タブ再読込・終了では机側の情報を失うため、保存データからの再開と新規ペアリングになる。
- 初回ハンドシェークが途中で切れてペアリングが完了しない場合は、初回受付のやり直しが必要なことがある。
- 各ペアは、その接続先のrelease成功、タブ内の手動再ペアリング、またはメモリ破棄まで有効。openは他のペアを置換しない。release後は古い復帰recordを再利用せず、次の接続のrecordに置き換える。経過時間による自動失効は今回設けない。
- AIへ返したrecordは、会話履歴や引継ぎから漏れるリスクがある。公開文書・リポジトリ・机・通常ログへ書かない。AIの秘密保持を保証する仕組みではない。

## 待機・時間・表示

- 復帰先未登録はclose 4000で待機を促す。机の内容や秘密は毎回送らない。
- 不一致や不正なハンドシェークはclose 4003で拒否。正しい机でも相手を確認できなければ停止する。
- 再試行間隔は最初250ms、次に1秒、2秒、以後5秒。通常のclose通知を受けてからの値であり、サーバー起動時間やブラウザの背景タブ制限を含む保証ではない。
- 未認証接続は最大8本、ハンドシェークはサーバー8秒、ブラウザ側9秒で打ち切る。ハンドシェークのアプリケーションメッセージは4096 bytes以下。WebSocket全体の受信上限24 MBは既存のままなので、大きいフレームの受信段階まで低コストを保証するものではない。
- 通常は控えめな「AI再接続待ち」。フッターへ失敗通知を繰り返さず、詳細を接続ペインに表示する。成功は静かに接続済みへ戻す。
- 確認不能時は「接続確認が必要」と目立つ案内を出し、保存または手動接続を促す。
- サーバーは接続・切断時刻、close code、保留要求数、stdin終了／シグナルによる停止理由を記録する。ペアの秘密や文書本文は記録しない。従来どおり、生成トークンの初回URLは起動ログに含まれる。

黙って途絶えた認証済み接続を検知するheartbeatは今回追加していない。closeが届かない状況では即時復帰を保証しない。ホストを延命する見せかけのMCP呼出しも行わない。

## 旧版からの更新

旧ブラウザはペアリングプロトコルを実装していないため、新版サーバーへそのままは接続できない。サーバーだけが更新された場合も旧机を勝手に再読込しない。

1. 旧タブの保存ボタンで最新の机を保護する。切断中でもUI保存は可能。
2. 保存できたことを確認し、人間の了承後にサーバー・ブラウザを更新する。
3. 初回受付を開いて新版で接続し、保存ファイルをUIまたは明示承認付きMCP読込で戻す。
4. 新ペアのrecordを保持し、内容を照合する。

既存タブの更新は実装とは別作業。今回の隔離試験は実際の机を更新したことを意味しない。

## 検証と根拠

- `tests/pairing.test.ts`：双方の乱数・役割・token・ペアIDへの証明の束縛、改変・再利用の拒否、不正peerの接続枠拒否、明示置換。
- `tests/connection-investigation.e2e.ts`：固定／生成の両方で停止・再起動、受付準備前の静かな待機、AIのrestore、切断中の人間の編集保持、偽証明で停止、手動置換、秘密の文書状態への混入防止。
- `tests/desk-release.test.ts`：旧UI・保留要求の拒否、不正ACK・期限切れ、途中の認証の無効化、古いcloseと新しい要求の分離、旧ペアの再接続拒否。
- `tests/desk-release.e2e.ts`：明示確認、棚・設定・履歴の保持、AI指示枠の消去、切断中のUndo／Redo・保存、自動再接続の停止、別の棚の接続、元の棚への手動復帰。
- [ws公式仕様](https://github.com/websockets/ws/blob/8.18.3/doc/ws.md)：Context7でsend／close／readyStateを確認。送信完了だけではなくアプリケーションACKを用いてから解放する。
- 既存のbridge認証・Origin拒否、複数接続、UI／MCP共同編集と保存・読込の試験も維持する。
- Linux Chromeでの隔離試験。Windowsや別ブラウザでの手動確認は未実施。
- 2026-10-16、利用者の了承後に実際の机へ反映。93パーツ（ピン4個を含む）と設定の保存復元を完全一致で照合し、AI側切断後の描画・revision維持と7秒後も未接続・受付中を確認した。利用者による同じタブへの手動再接続後も同じsession・revision・93パーツを確認。当時の複数棚切り替えは「接続解放 → 使いたい棚から手動接続」の運用とする。別の棚との切り替え自体の検証は上記の隔離E2E。実装：83df31a。

Context7で確認した公式仕様：

- [SubtleCrypto.importKey](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey)
- [SubtleCrypto.sign](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/sign)
- [SubtleCrypto.verify](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/verify)
- [Crypto.getRandomValues](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues)
- [Secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts)：ループバックは潜在的に信頼できるoriginとして扱われる。
