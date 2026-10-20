/** Shared catalog: SVG sources are bundled, and placed copies never depend on these files. */
export const propPresets = [
  { id: 'teacup', name: 'ひと息の湯呑み', description: '淡い青緑の湯呑みにお茶と湯気、にこっとした顔。おっさん用の小物。', filename: 'teacup.svg', width: 210, height: 274 },
  { id: 'coffee', name: 'ひと息のコーヒー', description: 'クリーム色のカップにコーヒーと湯気。小さなハートとウインク。', filename: 'coffee.svg', width: 210, height: 274 },
  { id: 'eraser', name: 'まるっと消しゴム', description: '淡いピンクの消しゴムと青い紙ケース。消す機能は持たない机の小物。', filename: 'eraser.svg', width: 240, height: 240 },
  { id: 'compass', name: 'くるりのコンパス', description: '青い脚と真鍮色のつまみ。円を描く機能は持たない机の小物。', filename: 'compass.svg', width: 210, height: 274 },
] as const;
