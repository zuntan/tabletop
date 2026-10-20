/** Shared catalog: SVG sources are bundled, and placed copies never depend on these files. */
export const propPresets = [
  { id: 'teacup', name: 'ひと息の湯呑み', description: '淡い青緑の湯呑みにお茶と湯気、にこっとした顔。おっさん用の小物。', filename: 'teacup.svg', width: 210, height: 274 },
  { id: 'coffee', name: 'ひと息のコーヒー', description: 'クリーム色のカップにコーヒーと湯気。小さなハートとウインク。', filename: 'coffee.svg', width: 210, height: 274 },
  { id: 'eraser', name: 'まるっと消しゴム', description: '淡いピンクの消しゴムと青い紙ケース。消す機能は持たない机の小物。', filename: 'eraser.svg', width: 240, height: 240 },
  { id: 'compass', name: 'くるりのコンパス', description: '青い脚と真鍮色のつまみ。円を描く機能は持たない机の小物。', filename: 'compass.svg', width: 210, height: 274 },
  { id: 'magnifier', name: '虫眼鏡', description: 'おっさん作。木の持ち手と真鍮の縁の虫眼鏡。拡大機能は持たない小物。', filename: 'magnifier.svg', width: 240, height: 274 },
  { id: 'envelope', name: '封蝋の封筒', description: 'おっさん作。クリーム色の封筒と赤い封蝋。', filename: 'envelope.svg', width: 240, height: 274 },
  { id: 'antique-key', name: '真鍮の鍵', description: 'おっさん作。少し傾いた古風な真鍮の鍵。', filename: 'antique-key.svg', width: 210, height: 308 },
  { id: 'desk-bell', name: '卓上ベル', description: 'おっさん作。銀色のベルと濃い色の台座。音は鳴らない小物。', filename: 'desk-bell.svg', width: 240, height: 274 },
] as const;
