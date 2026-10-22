/** Pattern-owned appearance; instances retain only identity, extra text and rotation. */
export const stampPatterns = [
  { id: 'done_ja', caption: '済', title: '済', shape: 'round', style: '朱印風' },
  { id: 'done_en', caption: 'DONE', title: 'DONE', shape: 'square', style: 'ゴム印風' },
  { id: 'rejected_ja', caption: '却下', title: '却下', shape: 'round', style: '朱印風' },
  { id: 'rejected_en', caption: 'REJECTED', title: 'REJECTED', shape: 'square', style: 'ゴム印風' },
  { id: 'sealed_ja', caption: '封印', title: '封印', shape: 'round', style: '朱印風' },
  { id: 'sealed_en', caption: 'SEALED', title: 'SEALED', shape: 'square', style: 'ゴム印風' },
  { id: 'on_hold_ja', caption: '保留', title: '保留', shape: 'round', style: '済を継承した朱印風' },
  { id: 'on_hold_en', caption: 'ON HOLD', title: 'ON HOLD', shape: 'square', style: 'DONEを継承したゴム印風' },
  { id: 'handle_with_care_ja', caption: '取扱注意', title: '取扱注意', shape: 'care', style: '開いた両手と大きな箱の共通図案・正方形枠' },
  { id: 'handle_with_care_en', caption: 'HANDLE WITH CARE', title: 'HANDLE WITH CARE', shape: 'care', style: '開いた両手と大きな箱の共通図案・正方形枠' },
  { id: 'shirangana_ja', caption: 'しらんがな', title: 'しらんがな', shape: 'squareBadge', style: '正方形枠に感嘆符と白縁の赤文字' },
  { id: 'nandeyanen_ja', caption: 'なんでやねん', title: 'なんでやねん', shape: 'round', style: '大きな疑問符と白縁の赤文字' },
  { id: 'hanamaru_ja', caption: 'はなまる', title: '', shape: 'flower', style: '丸みのある花びらと中央のうずまき' },
  { id: 'smile_ja', caption: 'ニコニコ', title: '', shape: 'smile', style: '花の輪郭とオリジナルの笑顔' },
  { id: 'keep_going_ja', caption: 'がんばりましょう', title: 'がんばりましょう', shape: 'words', style: '桜の花びらの縁取りと励ましの大きな文字' },
  { id: 'well_done_ja', caption: 'よくできました', title: 'たいへんよくできました', shape: 'words', style: '大きなごほうび文字と桜の花びらの縁取り' },
].map(pattern => ({ ...pattern, color: '#c93428', opacity: 0.9 }));
export const fallbackStamp = { id: 'fallback', caption: '未知ID用', title: '', shape: 'round', style: '基本文字なしの代替印', color: '#c93428', opacity: 0.9 };
export type Stamp = { designId: string; text: string; angle: number };
export function stampPattern(id: string) { return stampPatterns.find(pattern => pattern.id === id) ?? fallbackStamp; }
export function createStamp(designId: string, dated: boolean, now = new Date()): Stamp {
  const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('.');
  // SVG's negative rotation lifts the right side: left-downward as with a right-handed press.
  return { designId, text: dated ? date : '', angle: -(3 + now.getDay()) };
}
