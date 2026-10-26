# AIとの共同作業インタフェース

外部AI向けには、`/share/{shareId}` の文章案内から `desk_context`・`desk_get`・`desk_asset_read` を同名で取得できる読み取り共有があります。ローカルMCPの `desk_share_open`／`desk_share_close` で管理します。公開範囲・HTTPとMCPの応答の違い・実験手順は [読み取り共有](./docs_devel/read-only-sharing.md) を参照してください。共有の開始は外部公開を伴うため、人間の了承と専用トンネルの準備が必要です。

## 複数の机と必須の机ID

`desk_connections()` はペアリング済みの接続先を一覧し、`deskId`・接続状態・名前・配色を返します。**机に作用する全ツールで `deskId` が必須です。1机だけでも省略できず、カレント机もありません。** 以下の説明や操作断片で省略されている場合も、MCPの引数には必ず指定します。

例：`desk_summary({deskId:"ABCD-EFGH"})`、`desk_execute({deskId:"ABCD-EFGH",operations:[...]})`。IDは実際の一覧の値に置き換えます。無効ID・切断時に別机へ振り替えません。ファイルの同一性・保存先・会話上の「元の机」等を判定するキーではありません。

`desk_pairing_open` は追加受付で、既存の接続を残します。復旧は机ごとの秘密recordで `desk_pairing_restore`。新規接続は既存の `browserConnected:true` ではなく、一覧に追加された接続先で確認します。名前・タイトル色・壁紙を使った識別や必要な命名の提案はAIの判断です。判断できなければ確認します。

ID不要なのは、接続一覧・サーバー接続情報・新規受付・復帰recordの登録・ブラウザ起動・ポート/LAN・Help・小物/ハンコカタログです。ベル・共有・保存・接続解放も机別です。HTTPの読み取り共有はURLが対象を固定するため、追加の机ID引数は不要です。[設計と責任範囲](./docs_devel/multiple-desk-connections.md)。

## ブラウザを接続する

**初回は、利用者の了承後に `desk_pairing_open({ confirm: true })` で受付を開きます。** 接続したら `desk_connections` で机IDを確認し、`desk_pairing_info({ deskId })` の秘密recordを非公開の継続コンテキストに保持し、引継ぎでも残してください。再起動後は同じrecordを `desk_pairing_restore({ pairing })` へ渡し、数秒待ってから現在の机を読み直します。固定トークンでも同じ確認を行います。記憶を失った場合は推測せず手動再接続を案内し、既存タブを再読込しません。詳細・秘密の扱い・旧版の安全な更新は [接続復帰](./docs_devel/connection-recovery.md) を参照してください。

棚を残して現在の接続を解放する場合は、利用者の了承後に `desk_release({ deskId, confirm: true })` を使います。元のタブはローカル編集・保存を続けられ、自動再接続は停止します。成功時に以前のペアを無効にして新規・手動接続の受付を開きます。保存・読込・同期・トークン再生成は行いません。旧UIや保留要求は拒否し、応答未確認でも受付は開きません。エラー時は状態を確認し、推測で再送しません。成功後は以下の接続情報を案内し、次の接続の秘密recordを保持します。サーバー再起動からの復帰には使いません。

`desk_connection_info` はブラウザ未接続でも呼べるサーバー側の参照ツールです。既存の `url`・`port`・`tokenSource`・`tokenIncluded`・`browserConnected`・`pairingState` に加え、`bootstrapReady`・`nextAction`・状態別の `message` を返します。トークンを再生成せず、机も変更しません。

- `waiting-for-AI`：受付も復旧先も未設定。`nextAction.kind: ask-user` で新規・手動接続か復旧かを確認します。新規・手動接続は了承 → `desk_pairing_open` → `desk_connection_info` → URL案内の順。復旧は保持済みrecordで `desk_pairing_restore` を使い、openで代用しません。
- `new-pairing-open`：`bootstrapReady: true` は新規受付が開いた意味で、接続済みではありません。`nextAction.kind: browser-connect` に従ってURLを案内します。
- `paired` かつ未接続：ペア情報が登録されているだけです。`nextAction.kind: wait-for-browser` に従って既知の机の再接続を待ち、状態を再確認します。無断で受付を開き直しません。
- `browserConnected: true`：ブラウザ接続成立。`nextAction: { kind: call-tool, tool: desk_connections }` に従って対象IDを確認し、その机の秘密recordを非公開で保持して読み直します。

`nextAction` はツール名だけではなく行動の種類を示します。`ask-user` は `topic`、`call-tool` は `tool`、ブラウザ操作・待機は確認先の `verifyWith` を持ちます。各応答は取得時点の状態であり、受付開始・URL取得・URLを開く操作の成功を接続成立と扱わず、最後に `browserConnected: true` を確認します。受付前にも互換性のためURLを返しますが、そのURLだけでは接続できません。

接続タブは伏せ字のURL入力だけです。利用者はトークン付きURLを貼り、ページ移動・再読込せず接続できます。未許可ホスト・認証情報付き・クエリ付き・ポート不一致・重複パラメーターは拒否します。URLはタブ内に保持します。初回受付・手動置換の承認や復帰recordの原則は変わりません。

LANは毎回の起動で禁止です。人間の明示承認後だけ `desk_network_set({ enabled: true, confirm: true })` で同じポートを開き、`desk_connection_info` の `network`・`lanUrls` を参照します。HTTPは盗聴・改ざんを防ぎません。許可意図を非公開で保持し、再起動時は有効な承認がある場合のみLANを復元してからペアリングを復元します。端末切替は別途 `desk_release` が必要です。内容は自動移行しません。非空の元の机で扱いが未指定なら引継ぎを一度確認することを推奨しますが、必須ダイアログではありません。[手順・制限](./docs_devel/http-lan.md) を参照してください。

`tokenSource: "generated"` なら、起動時に生成したトークン付きURLを利用者へ案内できます。URLはそのサーバープロセス中だけ有効ですが、ツール結果や案内によって会話履歴に残る可能性があります。公開しないでください。

`tokenSource: "environment"` なら、env指定の固定トークンはツール結果にも起動ログにも出しません。利用者が通常の `url` に `#token=` とURLエンコードした設定済みトークンを手動で付けて貼ります。AIは非開示のトークンを推測・取得する必要はありません。HTTPにはトークン取得口を設けません。

## ひとりで考える

ヘッダーの固定ラベル「ひとりで考える」スイッチは人間だけが切り替えます。ONでは棚が受信時にAIの編集・読込・Undo/Redo・選択・指差し（解除を含む）・接続解放を拒否し、OFFではいっしょに考えます。`actor: "human"` でも回避できません。読み取り・画像参照・`desk_save` と会話は続けられ、人間の編集・保存・読込は止めません。ONにすると既存のAI指差しだけを消し、人間の選択や文書・履歴は変更しません。

拒否には「利用者は今、ひとりで考えています。この操作は実行していません。解除を促したり、自動で再試行したりせず、依頼を待ってください。」を返します。AI側のフラグ監視は不要です。操作は保留せず、戻した後も自動再試行しません。解除を促さず、次の依頼を待ってください。

モードはタブ内メモリだけで保持し、通常の再接続・ファイル読込では維持、ページ再読み込みでは「いっしょ」に戻ります。ファイルには保存せず、MCPからの変更APIもありません。認証・接続状態とは別で、情報を隠すためのモードではありません。

## 棚を名前で呼ぶ

`desk_summary`／`desk_context`／`desk_state`／`desk_list` の `name` が棚の名前、`deskId` が今開いている棚の短い公開目印です。会話には名前を使えますが、ツールのルーティングは常にIDで行います。名前の空文字は「無題」。名前はファイルに保存しますが、棚IDは保存せず、読込・通常の再接続でも現在の値を維持します。新規ペアリング時は接続先IDへ変わり、永続性は保証しません。同じファイルを別タブで開けば別IDです。認証やrevisionガードには使わず、従来どおり `sessionId`／`revision` を使います。

改名は人間の依頼時だけ、`desk_execute` の `{ kind: "desk_rename", name: "企画メモ" }` と現在の `expectedRevision` を使います。共通Undo対象です。人間側ダウンロード名は `棚の名前.tabletop`（時刻なし）、AIの保存名指定は従来どおり。予定ダウンロード名の専用取得機能はありません。詳細：[棚の名前・棚ID・保存名](./docs_devel/desk-identity.md)。

## 机の保存・読込

`desk_save` は専用フォルダーへ画像込みの `.tabletop` を排他作成します。`desk_load` は利用者の置換許可、`confirm: true`、現在の `expectedSessionId`／`expectedRevision` が必要で、一回のUndoで戻せます。保存形式はUIと共通です。既定の保存先はサーバー側の `~/.tabletop/saves/`、変更は `TABLETOP_SAVE_ROOT`。名前だけを指定し、任意パスや上書きは禁止です。新版サーバー・ブラウザが必要なので、旧タブは先にUI保存して保護してください。引数・転送上限・失敗時の扱いは [MCP保存・読込](./docs_devel/mcp-save-load.md) を参照してください。

## 最初に読むもの

`desk_context` は、一回のブラウザ応答で次を返します。画像のbase64は含みません。

- `sessionId`・`revision`・件数・Undo/Redo可否・選択ID
- 背面から前面順のオブジェクト情報（Markdown原文や画像タイトルを含む）
- `connections`：線／矢印のID、始点・終点、接続先IDと辺。未接続は `binding: null`
- `settings.grid`：共有・保存するスナップのON／OFF、間隔、格子の原点。新規・旧ファイルの省略時はON・24・原点0
- `settings.series`：ピンシリーズの書式・共通スタイル・次番号・`members`（ID、番号、表示文字、説明）
- `history`：現在の机で起きた変更と前後情報。初期値は先頭から100件

`history.hasMore` がtrueなら `sinceRevision: history.nextRevision` で続きを読みます。以後は最後に確認したrevisionから読み、`sessionId` が変わったら新しい机として扱います。差分の自動通知はありません。参照操作は机を変更しません。

細かい取得は従来の `desk_summary / desk_list / desk_get / desk_settings / desk_changes / desk_selection` も利用できます。`desk_state` は画像データを含む全状態なので大量画像の机では避けてください。

## 指差す（人間の選択とは独立）

質問や注目してほしい対象には `desk_point` の `{ "ids": ["object-id"] }` を使います。緑枠で表示し、人間の青い選択・編集中の入力・文書revision・Undo/Redoは変えません。対象をチャットでも説明し、確認が済んだら `{ "ids": [] }` で解除してください。毎回AI側の指差し集合を置き換えます。

人間もツールパネルの「選択」の隣にある「AI選択解除」で指差しを解除できます。解除後は現在の `aiPointing` を基準に扱い、以前の指差しを自動で戻さないでください。

`desk_context / desk_state / desk_selection` の `aiPointing` で現在の指差しIDを読めます。削除された対象と切断時の指差しは解除し、Undoでも復元しません。人間が操作中のジェスチャーでは再試行が必要な場合があります。緑枠に編集ハンドルはありません。編集はオブジェクトIDで行い、指差しは不要です。従来の `desk_select` は人間の編集対象を変えるため、単に「これのこと？」と示す用途には使わないでください。

## マウス操作のロック

ロックはオブジェクト単位の `locked`（省略はfalse）。人間の意図しないマウス／タッチでの移動・サイズ変更・線の端点変更だけを防ぎます。権限や編集禁止ではなく、選択・フォーカス・ダブルクリック編集・プロパティ変更・明示的な削除・キーボード操作・AIによる移動や編集は可能です。接続線はロック中も接続先へ追従します。ダブルクリック編集を禁止する設定は将来候補で、現時点では追加しません。

- AIは `desk_point({ ids: [...] })` → `desk_lock({ locked: true })`／`desk_lock({ locked: false })` で、緑枠の対象へ明示的に設定。人間の青い選択は参照・変更しません。**緑枠が空ならエラーで、机全体とは解釈しません。**
- 既存の一括操作と同じ上限200個。1命令を原子的に適用してUndoも1回。`expectedRevision` に対応し、不正要求・競合・件数超過で一部だけ変更しません。同じ状態への設定はrevision・Undoを増やしません。戻り値は対象 `ids`、`locked` とsummary（変更時はplacementも含む）。
- `desk_execute` の `update.patch.locked` でIDを直接指定しても変更できます。ピンも個別に変更でき、シリーズの共通設定ではありません。読み取り・履歴・保存ファイルに状態を含みます。従来ファイルで属性がなければ未ロックとして扱います。
- UIはスナップ隣とプロパティの切り替え。非選択は無効。全件ロックなら解除、それ以外（混在を含む）は全件ロック。混在は `aria-pressed="mixed"` で示します。複数選択をドラッグすると未ロックだけ動き、ロック済みを直接つかんでも動きません。
- ロック中の青枠は細かい破線と右下の鍵。サイズ変更・端点ハンドルは非表示、カーソルは通常の矢印。鍵は非インタラクティブで、AIの緑枠は従来どおりです。
- 「ひとりで考える」中・人間の編集中はAIのロック切り替えを拒否。自動再送はしません。

根拠：[MDN aria-pressed](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-pressed)、[SVG pointer-events](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/pointer-events)、[stroke-dasharray](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/stroke-dasharray)。鍵は `pointer-events="none"` で選択を妨げず、ネイティブbuttonの無効状態・キーボード操作を維持します。

## カメラを合わせる

`desk_point({ ids: [...] })` でAIの対象を決めてから `desk_fit({})` を呼ぶと、その範囲を余白付きで表示します。緑枠が空なら机全体。人間の青い選択は参照も変更もしません。全体へ戻す場合は `desk_point({ ids: [] })` → `desk_fit({})`。指差すだけではカメラは動きません。

戻り値は `ids`、`scope`（`selection`／`all`）、`camera`（`x`・`y`・`zoom`）。空の机はカメラを変えません。パーツの座標・サイズ、文書revision・Undo/Redo・保存内容には影響しません。表示倍率の既存範囲内で、説明文が表示中のピンはその説明も収めます。

これは人間が見ている画面を動かす操作なので、単なる読み取りのついでに呼ばないでください。「ひとりで考える」中、編集中・ジェスチャー中は拒否し、自動再試行しません。人間の右下の表示ボタンも同じ計算を使いますが、人間自身の選択だけを対象にします。

人間のスクロールを優先します。アプリ上のホイール（タッチパッドを含む）とページ／右ペイン／入力欄等のネイティブscrollイベントから、最後の入力後400ms静まるまでは `desk_fit`・`desk_camera_move` を受信時にキャンセルします。保留・予約・自動再試行はしません。読み取りと人間自身の操作は止めません。ネイティブscrollの原因は区別せず、プログラムによるスクロールも安全側で同じ扱いにします。実行中のカメラアニメーションも、その時点の表示で即座に止めます。元の位置へ戻したり、目的地へ飛ばしたり、静まった後に再開したりしません。

検出の根拠：[MDN wheel event](https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event)。ホイールはスクロールせずズームする場合もあるため、wheelとscrollの両方を監視し、人間のイベント自体はキャンセルしません。

### AIカメラの滑らかな移動

- `desk_fit`・`desk_camera_move` は1回の命令でブラウザ側がパンとズームを連動させ、緩やかに加減速する。既定の所要時間は画面何枚分の移動かと倍率差で250〜900msに自動調整し、遠距離では途中で引いてから寄る。毎フレームのMCP呼び出しは不要。
- 両ツールとも任意の `durationMs`（0〜2000）を指定できる。省略は自動、0は瞬時。例：`desk_fit({ durationMs: 700 })`、`desk_camera_move({ pan: { x: 120, y: 0 }, durationMs: 400 })`。時間だけの `desk_camera_move` は不可。同じ表示への移動は瞬時。
- 成功結果は完了後の表示。`desk_camera_get` は移動中も現在フレームの表示を返す。相対移動の起点・フォーカス対象は命令受信時に確定する。
- wheel／scrollのほか、pointer／touch入力、キー、クリック、入力変更で即時中断。サイズ変更、非表示化、接続切断／解放、読込、後続のカメラ命令でも停止する。中断はエラー結果となり、現在位置を保ち、自動再送・再開しない。バックグラウンド等でフレームが来なくても、指定時間＋1秒の期限で中断し、サーバーの10秒タイムアウトを待ち続けない。
- OSの「視差効果を減らす」設定時は瞬時に適用。人間のオブジェクトリストからのフォーカスと、右下の「全体／選択範囲」ボタンも同じカメラアニメーションを利用する（2026-10-18）。ホイール・ドラッグと保存ファイル読込時の自動表示合わせは従来どおり瞬時。UIは追加しない。パーツ移動のアニメーション・カメラ追従は別の将来案で未実装。

実装根拠：[D3 Zoom interpolation](https://d3js.org/d3-interpolate/zoom)、[MDN requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)、[cancelAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/cancelAnimationFrame)、[prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)。

配置の実装根拠：[MDN position](https://developer.mozilla.org/en-US/docs/Web/CSS/position)。表示パネルはプロパティ欄も含む作業エリア全体を包含ブロックとする絶対配置で、下に専用の行は確保しません。

### 任意のパン・ズーム

- `desk_camera_get({})` は現在の表示を読むだけ。`center` は画面中央の机上座標、`zoom` は倍率（1が100%）、`viewport` はキャンバスのCSSピクセル幅・高さ、`visibleBounds` はキャンバス矩形に対応する机上範囲。UIの重なりによる遮蔽は差し引かない。編集中・ドラッグ中・「ひとりで考える」中も読み取り可能。
- `desk_camera_move({ pan: { x: 120, y: 0 } })` は見る位置を右へ120机上単位動かす。パーツは画面上では左に流れる。座標はパーツと同じ単位で、画面ピクセルではない。「画面の4分の1だけ右」なら `visibleBounds.width / 4` を使う。
- `desk_camera_move({ zoomBy: 1.25 })` は受信時の倍率を1.25倍にする。`{ zoom: 1 }` は100%へ戻す。倍率だけなら画面中央の机上位置を保つ。
- `desk_camera_move({ center: { x: 1200, y: 800 }, zoom: 1.5 })` は指定座標を中心に150%表示。`pan` と倍率指定も併用でき、パンの机上単位は倍率に依存しない。
- `center` と `pan`、`zoom` と `zoomBy` はそれぞれ同時指定不可。少なくとも一つ必要。座標指定は各軸±2,000,000以内の有限数、倍率は0.05〜8、相対倍率は0.01〜100。相対倍率で表示上限・下限を超えた場合だけ0.05〜8へ制限し、`zoomClamped: true` を返す。矛盾・非数・範囲外ならカメラを変更しない。
- 移動結果は `desk_camera_get` と同じ表示情報＋`zoomClamped`。人間・AIどちらの選択も参照・変更せず、パーツ・revision・Undo/Redo・保存内容も変えない。編集中・ドラッグ中・「ひとりで考える」中は移動を拒否する。表示は人間と共有なので、必要な案内・調整としてのみ使い、自動再試行・再送しない。

座標変換の根拠：[MDN SVG transformations](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorials/SVG_from_scratch/Basic_transformations)。机上座標とCSSピクセルを区別し、既存の平行移動・拡大縮小へ変換する。OS座標や画面解像度の指定は不要。

## 同じ格子へ置く

`desk_execute` と追加時の `desk_asset_import` は `snap: "desk"` が既定で、現在の `settings.grid` に従います。`snap: "exact"` でバッチ／取り込み単位に回避でき、全体のON／OFFは変えません。通常は左上、全ピンは枠の下中央、線は自由端点を合わせ、明示したBindingを優先します。数値を推測せず、応答の `placement.results` の `requested`／`applied`／`snapped`／使用した `grid` を確認してください。

複数パーツの共通移動は相対位置を維持し、先頭のパーツまたは `snapAnchorId` を基準にします。全体設定を変える `grid_update` は**人間に依頼されたときだけ**使い、細かい配置のたびに切り替えません。取得・保存・例外・複数移動の条件は [共通スナップ](./docs_devel/shared-snap.md) を参照してください。

## 接続する

`desk_execute` の一括操作で、接続先と矢印を同時に作れます。

```json
{
  "actor": "agent-01",
  "expectedRevision": 0,
  "operations": [
    { "kind": "add", "object": { "id": "a", "type": "rect", "x": 100, "y": 100, "text": "開始" } },
    { "kind": "label_add", "id": "p1", "seriesId": "series-1", "x": 450, "y": 110, "description": "確認する" },
    { "kind": "add", "object": { "id": "edge", "type": "arrow", "startBinding": { "objectId": "a", "anchor": "right" }, "endBinding": { "objectId": "p1", "anchor": "center" } } }
  ]
}
```

辺は `top / right / bottom / left`。接続先は矩形・角丸矩形・楕円・全種類のピン・Markdownメモの枠です。画像・Webカードへの接続は現時点では対象外です。対象の移動・サイズ変更には追従します。解除は `update` の `patch: { "endBinding": null }`（またはstartBinding）。解除時の端点は保持します。UIは選択した1〜2個から自動接続を選べますが、MCPの追加はBindingを明示する方式のままです。

## 連番として扱う

ピンは内部型 `label`、同じ `seriesId` が同じシリーズです。次の番号を計算して直接書くのではなく、`label_add` で追加します。現在最大番号＋1がシリーズの上限内で割り当てられます。上限では同じ番号を繰り返すため、番号だけで識別せずIDを使います。

シリーズのスタイル変更は `series_update`、個別位置・説明・リアクションは `update`。既存ピンを勝手に採番し直しません。削除・移動・共通Undoは通常オブジェクトと同じです。並べ替えはシリーズ全体に適用します。

## リアクションを付ける

全オブジェクト（ピンを含む）の `reactions` は、👍 👎 ❓ ❗ ⭕ ❌ ✔ 👀 ❤️ 🤔 🆗 💡 🎉 🙏 📌 ⏳ ⚠️ 😊 の重複なし配列（最大18個）です。旧 ✅・○・✕ はそれぞれ ✔・⭕・❌ の別表記として受け付けますが、同義の2表記を同時に含めることはできません。UIは既存の表記を自動変換せず、新しいボタンの操作で明示的に解除します。省略時はなし。`desk_execute` の `{ "kind": "update", "id": "p1", "patch": { "reactions": ["👍", "💡"] } }` で集合を置き換え、`[]` で全解除します。票数・参加者IDはありません。現在の `desk_context` 等から対象の配列とrevisionを読み、残したい絵文字を保持して `expectedRevision` 付きで更新してください。競合時は再取得します。

リアクションは対象に付属する文書データで、移動に追従し、対象削除で一緒に消え、共通Undoで復元されます。既定スタイル・ピンシリーズ・番号・接続位置には影響しません。バッジは表示専用で、付け外しはIDによる更新か人間の上部左ツールバーで行います。

## Markdownメモ

`type: "text"` の `text` がMarkdown原文。文字色は `textColor`、背景は `fill`、輪郭は `stroke` です。新規作成時は矩形と同じ外観の既定値を使い、明示した値は優先します。図形の `text` はプレーンテキスト・中央配置です。Markdown対応範囲は [AUTHORING.md](./AUTHORING.md) を参照してください。

`fillOpacity` は塗りの不透明度0〜1で、文字・輪郭の不透明度とは独立です。新規作成の既定値と新規ピンシリーズは0.3（70%透過）。既存オブジェクトにこの属性がない場合のスキーマ既定値は1です。`defaults_update`・個別 `update`・`series_update` で変更でき、既存のオブジェクトは既定値の変更だけでは変わりません。画像やカードの本体はこの属性で薄くしません。

## 画像／SVGの読み取り

`desk_context`・`desk_list`・`desk_get` の画像には、読取専用の `imageGeometry` が付きます。カード枠・タイトル下の領域・余白を除いた画像矩形・ブラウザの自然寸法を分離します。座標変換、非同期の状態、SVG／外部URLの制限は [画像座標メタデータ](./docs_devel/image-geometry.md) を参照してください。旧ブラウザにはこのフィールドがありません。

`desk_asset_read` に `id` を指定します。

- PNG／JPEG／GIF／WebP：メタデータのtextブロック＋標準MCP imageブロック（base64とMIME）
- SVG：textブロックのJSONに `svg` として元のSVGコード
- `exportFile: true`：加えてサーバー側の一時ファイル絶対パスを返す。クライアントが画像ブロックを扱えない場合の橋渡し

一時出力はOS一時領域（通常 `/tmp/tabletop-assets-*`）、ディレクトリ0700・ファイル0600・既存パスの上書きなし。参照だけの場合はファイルを作りません。出力はサーバープロセスごとに合計100MBまでで、出力ファイルは終了後も残ります。必要な受け渡しが終わった後の削除は利用者が行います。

サーバーとAI側の実行環境でファイルシステムを共有する必要があります。リモート画像URLはサーバーから取得しません（SSRF・意図しない通信を避けるため）。URL画像を読む場合は、利用者が許可した取得手段で一時ファイル化してから取り込んでください。

## 取り込み・差し替え

`desk_asset_import` の `source` は以下のいずれか一つです。

```json
{ "id": "figure", "source": { "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"240\" height=\"120\"><rect width=\"240\" height=\"120\" fill=\"orange\"/></svg>" }, "x": 100, "y": 200, "width": 240, "height": 154, "title": "図" }
```

```json
{ "id": "photo", "source": { "path": "/tmp/my-photo.png" }, "title": "資料" }
```

または `source: { "dataUrl": "data:image/png;base64,..." }`。ファイル形式は拡張子ではなくヘッダーで判別し、SVGは名前空間付きの単独文書のみ、DOCTYPE／ENTITYを拒否します。画像デコードの完全性検証はせず、表示はブラウザに委ねます。1枚5MB以下です。

`mode: "add"` が初期値。IDは一意で、既定サイズは480×354（タイトル欄34＋画像領域320）です。自然寸法に合わせる場合はwidthとheightを明示します。`title` はカードの `text`、`url` は任意リンク。

```json
{ "id": "figure", "mode": "replace", "source": { "path": "/tmp/replacement.svg" }, "expectedRevision": 12 }
```

差し替えは `src` だけを更新し、同じID・型・位置・サイズ・タイトル・リンクを保持します（画像形式を変えてもオブジェクト型は保持）。差し替え時のgeometry/title/url指定は拒否します。差し替え対象確認後はrevisionを自動でガードし、途中で机が変われば適用しません。

ファイル読み取りはサーバー側だけで行い、`TABLETOP_ASSET_ROOT` 以下の絶対パスに限定します（初期値はOS一時領域）。シンボリックリンクで許可領域外に出るパス、通常ファイル以外、上限超過は拒否します。必要なら専用共有ディレクトリを作り、環境変数でより狭く指定してください。MCPはローカルファイル読取権限を持つ信頼済みクライアント専用です。

## 変更・失敗・履歴

取り込み／差し替えも人間と共通の一回のUndoになります。`expectedRevision` はAI操作で指定を推奨します。編集やドラッグ中は再試行エラー。タイムアウトや切断で結果不明なら、同じ操作を直ちに再送せず現在revision・対象ID・履歴を確認してください。机を一回の応答で読んでも、その後の操作までロックされるわけではありません。

根拠：MCP SDK [tools](https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.x/docs/server.md)・[Node.js fs API](https://nodejs.org/docs/latest-v24.x/api/fs.html)。


## ピンシリーズの表示・糸・レイヤー（2026-10-18）

`series_add`／`series_update` の `visibility` は `all`／`pins`／`hidden`。`thread` は `enabled`・`visible`・`color`・`width`・`opacity`・`dash` を持ち、一部更新は既存値へマージします。設定は共有・保存・Undo対象。閲覧タブの全体表示モードはこれより強い制限をかける一時状態で、MCPから変更しません。非表示はアクセス制御ではありません。

同じシリーズのピンは文書順で一つの連続区間になり、一つの `reorder` で全体が動きます。糸は独立パーツではありません。ピンの図柄・文字は固定画面サイズで、保存座標の下部中央が机上の基準点です。カメラ操作で文書座標や寸法を変えません。詳細・保存互換性・未確認事項は [ピン更新](./docs_devel/pin-update.md) を参照してください。

## 文章の収まり測定

`desk_text_measure({ids:["card-a"]})` はtext・rect・roundedRectの縦横はみ出しと、現在幅で必要な高さをブラウザ描画から読み取ります。測定のみで編集・選択・カメラ変更はせず、ひとりで考える中も使えます。`status` が `measured` の結果だけを利用し、横にはみ出す場合は高さだけで解決できません。フォント待ち等は成功扱いしません。[応答と制限](./docs_devel/text-measure.md)。

textは `cornerRadius` と上下左右共通の `padding`（省略時6）で一枚のMarkdownカードにできます。背景と本文を別パーツに重ねる必要はありません。

## 8点アンカー

線・矢印のBindingは上下左右に加え `top-left` / `top-right` / `bottom-left` / `bottom-right` を指定できます。角丸・楕円の斜め位置は輪郭上です。ピンの新規接続は外枠中心の `center` を使い、旧上下左右Bindingは保持します。直接のピン取り付け・線同士の接続は未実装。[仕様](./docs_devel/eight-anchors.md)。

## 机の壁紙

`desk_execute` の `background_update` で `settings.background` を部分更新します。例：`{"kind":"background_update","patch":{"wallpaper":"wood"}}`。柄は `none` / `wood` / `cutting-mat` / `pink-notebook` / `charcoal`。colorとshowGridはnullで柄に応じた自動値へ戻せます。selectionColor／pointingColorは人間／AIの枠色を上書きし、nullなら壁紙の既定色。wallpaper指定時は、同時に指定した色を除き枠色を自動へ戻します。パーツの色やスナップを変えず、Undo・保存に対応。壁紙の設定画面は未実装。UIの明暗はブラウザ側の独立した設定です。[仕様と互換性](./docs_devel/desk-background.md)。
## 線・矢印の線種

線・矢印の任意属性 `dash` は `solid` / `dashed` / `dotted`。省略は実線。端点とBindingは維持され、矢印先端は塗りつぶしのまま。[仕様](./docs_devel/connector-line-style.md)。

内部の接続パーツは `type: "line"` に統一。`startMarker` / `endMarker` は `none` / `arrow` / `circle` / `diamond`。新規の矢印は `{"type":"line","endMarker":"arrow"}`、両矢印は両方arrowを指定する。旧 `type:"arrow"` は入口で変換して受け付けるが、保存・返却はlineのみ。

### ブラウザUIの表示モード

`desk_context.ui.theme` / `desk_ui_get` は接続中ブラウザの `light` または `dark` を返す。
人間の依頼時は `desk_ui_set({theme: "light" | "dark"})` で切り替えられる。
ブラウザ内の好みとして記憶し、机の保存・リビジョン・Undo・壁紙には影響しない。
ひとりで考えるモードでは取得のみ。表示状態はリビジョンが同じでも変わり得る。


### 壁紙の不透明度
`background.opacity`（0〜1、既定1）を `background_update` で変更できる。
壁紙の色・模様・背景グリッドを一つの層として固定の中間グレー `#808080` に重ねる。
0ならグレーだけ、1なら従来の壁紙。パーツ・枠色・UIテーマは変更しない。
机ファイルへ保存し、Undo対象。旧ファイルは1。テーマや壁紙の切り替えで自動変更しない。
設定画面は今回追加せず、AI経由で調整する。


下地は `background.underlayBrightness`（0=黒、1=白、既定0.5）でグレースケール指定できる。
「下地の明るさ」スライダーは左が白、右が黒。プレビュー・確定・保存・Undoは不透明度と同じ。
従来の固定グレーは初期値として維持し、壁紙・UIテーマの切替ではこの値を変えない。

## 線同士の接合（開発ブランチ）
線のstartJunction/endJunctionで端点グループを共有。保存・Undoに含む。図形へのstartBinding/endBindingとは別。詳しくは[接合仕様](docs_devel/connector-junctions.md)。

## ピンの直接取り付け
label.attachmentは{objectId,anchor}またはnull。テキスト・矩形・角丸矩形・楕円へ先端を留め、対象変更に追従。ピン同士・線への取り付けは禁止。明示的なupdateで設定・解除する。詳細はdocs_devel/pin-attachments.md。

## テキストの吹き出し（試用）
text.calloutは{x,y,binding?:{objectId,anchor}|null}、null/省略で無効。先端はワールド座標。本文としっぽは一パーツで、根元は自動配置。対象のアンカー変更に先端だけが追従する。詳細はdocs_devel/text-callouts.md。

## 図形の追加と文字サイズ
既存rect/roundedRect/ellipseにdiamond/parallelogram/cylinder/document/cloudを追加。新5種のアンカーはtop/right/bottom/leftのみ。textFit:autoで拡大縮小、shrinkで指定fontSizeを上限に縮小。省略は従来の固定文字サイズ。図形の近似・文字サイズはdocs_devel/diagram-shapes.md参照。

## 有効なプロパティのみの取得・保存
保存とMCP取得・履歴・共有GETは、種類ごとに意味のある項目だけを出力する。線の塗り・文字サイズや、メディアの固定装飾に対する見かけの設定値は出さない。有効な0や既定値は残す。旧ファイルの読取は互換。詳細はdocs_devel/meaningful-properties.md。

原点の縦横線は、対象deskIdの `desk_execute` → `background_update` で `originAxes:true/false` と `originAxesColor:"#94a3b8"` を設定します。省略時OFF、色は固定で壁紙に追従しません。部品ではなく表示補助で、選択・全体表示範囲・PDFには含めません。

## 長文カードの分割
「分割して」と依頼された場合は `desk_help({topic:"card-splitting"})` を参照。意味単位で分け、原本は全文・付属物・接続とも保持する。分割先とクリップへハンコ・シール・リアクション・接続を複製しない。未指定は上留め・直前カード基準100%で縦並び、横指定なら左留め・同100%。専用UIや結合操作は追加しない。
