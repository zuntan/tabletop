export const reactions = ['👍', '👎', '❓', '💡', '❤️', '✅'] as const;
export type Reaction = typeof reactions[number];
export const reactionNames: Record<Reaction, string> = {
  '👍': '賛成', '👎': '反対', '❓': '質問', '💡': 'アイデア', '❤️': '好き', '✅': '確認済み',
};
