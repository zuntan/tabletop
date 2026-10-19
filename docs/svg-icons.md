# 操作アイコン

2026-10-19。Tabler Iconsのoutline SVGを必要な分だけ同梱し、インラインSVGで表示する。ツールバー18px、ヘッダー20px、名前編集16px。24×24のviewBoxと線幅1、currentColorで統一する。短いラベル、ツールチップ、アクセシブル名は維持し、ズーム倍率の数字は文字のまま。

「ピン」「ピン設定」は同じmap-pin。操作アイコンが対象であり、リアクションや文書内の絵文字、キャンバス上の図形は変更しない。壁紙・保存形式・UIテーマ設定も変更しない。

素材と版情報：src/vendor/tabler/README.md。MITライセンス：src/vendor/tabler/LICENSE。配布用コピー：public/licenses/tabler-icons.txt。外部通信や追加の実行時依存は不要。

表示はsrc/icons.tsに集約する。信頼できる同梱SVGだけを解析し、ユーザー入力や外部SVGを渡さない。ボタンへの割り当てはsrc/tool-caption.ts、ヘッダーはsrc/header-icon.ts。
