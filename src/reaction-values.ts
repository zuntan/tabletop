export const reactionChoices = ['👍', '👎', '❓', '❗', '○', '✕', '✔',
  '👀', '❤️', '🤔', '🆗', '💡', '🎉', '🙏', '📌', '⏳', '⚠️', '😊'] as const;
// Keep the original check mark valid without rewriting existing documents.
export const reactions = [...reactionChoices, '✅'] as const;
export const canonicalReaction = (reaction: Reaction): Reaction => reaction === '✅' ? '✔' : reaction;
export const hasReaction = (current: readonly Reaction[] | undefined, reaction: Reaction) =>
  current?.some(value => canonicalReaction(value) === canonicalReaction(reaction)) ?? false;
export type Reaction = typeof reactions[number];
export const reactionNames: Record<Reaction, string> = {
  '👍': 'Good', '👎': 'Bad', '❓': '質問', '❗': '感嘆', '○': '丸', '✕': 'バツ', '✔': 'チェック',
  '👀': '見る', '❤️': 'ハート', '🤔': '悩む', '🆗': 'OK', '💡': 'アイデア', '🎉': 'お祝い', '🙏': 'ありがとう',
  '📌': '注目', '⏳': 'あとで', '⚠️': '注意', '😊': 'にっこり', '✅': 'チェック',
};
