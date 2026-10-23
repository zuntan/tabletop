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
  { id: 'vacant-lot', name: '空き地', description: '緑の枠と空き地の看板、小さな草と双葉。中央は透明。枠だけ伸縮し、看板や文字は大きさを保つ。', filename: 'vacant-lot.svg', width: 480, height: 354, responsive: true },
  { id: 'work-in-progress', name: '作業中', description: '控えめな枠と、中央の木製・脚付き看板。看板以外は透明。枠だけ伸縮し、看板や文字は大きさを保つ。', filename: 'work-in-progress.svg', width: 480, height: 354, responsive: true },
  { id: 'temporary-area', name: '仮置き場', description: '青灰色の浅いトレー風の枠と仮置き場の看板。中央は透明。枠だけ伸縮し、看板や文字は大きさを保つ。', filename: 'temporary-area.svg', width: 480, height: 354, responsive: true },
] as const;
