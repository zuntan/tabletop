# 固定印影のアウトラインデータ

固定の印影文字・記号だけをSVG pathへ変換する。日付・任意の補足文字列、机の本文は従来の文字のまま。保存するdesignId/text/angleと机のversionは変更しない。

元のLinux/Chromeで実際に描画した字形と文字送り、middleベースラインの位置を計測した。serif／sans-serifは総称指定だったため、計測環境の実フォントはNoto Sans CJK JP Regular（日本語のフォールバック）とLiberation Sans Bold／Serif Boldの3フェイス。日本語を新しい字体へ置き換えるのではなく、今の字形を固定する。CSS上の太さ800と実際のフォールバックのウェイトは別。

- `scripts/data/stamp-outline-metrics.json`：42固定ラベル、各文字の送り・実フォント・ベースライン、元フォントの版／SHA256／著作権。
- `scripts/generate-stamp-outlines.py`：fontToolsで字形輪郭を生成。通常ビルド・実行時は不要。
- `src/stamp-outlines.json`：生成済みの固定ラベルの輪郭と幅。
- `src/stamp-outline.ts`：既存の位置・サイズ・textLength・白い縁取り等を保って固定文字だけを置換。
- `licenses/supplemental/stamp-outlines.txt`：元フォントの出典・著作権・OFL全文。ビルドで第三者通知集へ収録。

再生成はPythonのfontToolsと、記録したSHA256に一致する元フォントを用意し、`python3 scripts/generate-stamp-outlines.py --font-root /path/to/fonts`。生成物をコミットする。実行時にフォントファイルを読み込まず、ネットワーク取得も行わない。新しい固定文字を追加する際は計測データと輪郭も追加し、全印影テストを通す。既知の固定文字の輪郭が欠けた場合は黙って環境フォントへ戻さずエラーにする。未知IDの既存fallbackと利用者補足文字列は従来どおり保持。

日付の太さ・位置・余白調整は別工程。アウトライン後に確認エリアを形別に並べ替えてから、赤い▲の指摘と対象外の類似形を合わせて検討する。
