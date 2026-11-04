# 開発資料

このフォルダーは、開発時に必要な設計・調査・検証・作業机の記録を置く場所です。通常版・Pages版・MCPの動作時には不要であることを前提とします。実行時に必要な説明書や利用者向け文書は `docs/`、素材は対応する配布用フォルダーへ配置します。

旧 `docs/` から移した開発経緯も含みます。利用者向け文書の入口は [docs/README.md](../docs/README.md)です。

- [現在の作業机と復元先](current-desk.md)
- [公開情報・Aboutの記録](public-info-and-license.md)
- [第三者ライセンスと配布通知](third-party-licenses.md)
- [MCPから読める操作説明書](../docs/help/README.md)
- [開発用の机スナップショット](desk-snapshots/README.md)

READMEなどからの既存リンクは、参照切れを避けるため移動先へ向けています。利用者向け入口として何を残すか・新しいdocsへ何を案内するかは、今後個別に検討します。

## 移動と配布範囲

- 文書の相互リンク、実装・テストからの参照を移動先に合わせます。
- 過去の `.tabletop` スナップショットは、その時点の記録として内容を変更しません。内部に旧 `docs/` 表記がある場合は `docs_devel/` に読み替えてください。現在使用中の机の参照は更新します。
- `.gitattributes` の `export-ignore` は未決定です。この移動だけで配布対象外にはしていません。
- `desk_help` の操作説明書は利用者向けの `docs/help/` へ配置し、実行時もそこから読みます。docs_develは開発記録です。
- READMEのMCP設定例は個人環境のパスを使わず、配置先へ置換するLinux／macOSの例と、既存のWindows手順への案内にします。

- [複数の机との接続と識別](./multiple-desk-connections.md)：必須deskId、机別の復旧・ベル・共有。

- [Pages版](pages-viewer.md)：AIなしの静的配信、URLによる机の読込、公開手順。
- [入力欄の開始サイズとAI分割](inline-editor-bounds.md)：画面内補正と、原本を残す意味単位のカード分割。
- [定規レイアウト](ruler-layout.md)：自由・均等・中心均等、両側配置、素材とファイル収納。
- [連続線・フリー連続線](continuous-line-input.md)：入力モード、粗い清書、端点接合とUndo。

- [AIの操作調整・指差し・カメラ](ai-workspace-controls.md)：ひとりモード、ロック、カメラ移動と中断。
- [AIの机参照と画像入出力](ai-asset-io.md)：context、画像取得・取込・差し替えと容量。
