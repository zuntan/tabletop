export const stickerShapeNames = {
  circle:'丸', star:'星', triangle:'三角', diamond:'菱形',
  'alert-square-rounded':'注意', heart:'ハート', seedling:'芽', 'michelin-star':'花形',
  award:'メダル', trophy:'トロフィー', 'mood-smile':'笑顔', paw:'肉球', pig:'ぶた', mickey:'ミッキー', ghost:'おばけ',
} as const;
export const stickerShapeIds = Object.keys(stickerShapeNames) as [keyof typeof stickerShapeNames,...(keyof typeof stickerShapeNames)[]];
export type StickerShape = keyof typeof stickerShapeNames;
