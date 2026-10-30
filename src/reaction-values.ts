export const reactionBars=['▁','▂','▃','▄','▅','▆','▇','█'] as const;
export const reactionMoons=['🌑','🌒','🌓','🌔','🌕','🌜','🌛'] as const;
export const reactionChoices = ['👍', '👎', '❓', '❗', '⭕', '❌', '✔',
  '👀', '❤️', '🤔', '🆗', '💡', '🎉', '🙏', '📌', '⏳', '⚠️', '😊', '▶', '⏸', '🔁', '🔍', '🛠', '💤', '🚩', '🔒', '📎', '📝', ...reactionBars, ...reactionMoons] as const;
// Keep original symbols valid without rewriting existing documents.
export const reactions = [...reactionChoices, '✅', '○', '✕'] as const;
export const canonicalReaction = (reaction: Reaction): Reaction =>
  reaction === '✅' ? '✔' : reaction === '○' ? '⭕' : reaction === '✕' ? '❌' : reaction;
export const hasReaction = (current: readonly Reaction[] | undefined, reaction: Reaction) =>
  current?.some(value => canonicalReaction(value) === canonicalReaction(reaction)) ?? false;
export type Reaction = typeof reactions[number];
export const reactionNames: Record<Reaction, string> = {
  '🚩':'旗','🔒':'鍵','📎':'添付','📝':'メモ',
  '▁':'高さ1','▂':'高さ2','▃':'高さ3','▄':'高さ4','▅':'高さ5','▆':'高さ6','▇':'高さ7','█':'高さ8',
  '🌑':'新月','🌒':'三日月','🌓':'半月','🌔':'満月の手前','🌕':'満月','🌜':'左向きの月','🌛':'右向きの月',
  '▶':'再生', '⏸':'一時停止', '🔁':'繰り返し', '🔍':'虫眼鏡', '🛠':'道具', '💤':'眠り',
  '👍': 'Good', '👎': 'Bad', '❓': '質問', '❗': '感嘆', '○': '丸', '✕': 'バツ', '⭕': '丸', '❌': 'バツ', '✔': 'チェック',
  '👀': '見る', '❤️': 'ハート', '🤔': '悩む', '🆗': 'OK', '💡': 'アイデア', '🎉': 'お祝い', '🙏': 'ありがとう',
  '📌': '注目', '⏳': 'あとで', '⚠️': '注意', '😊': 'にっこり', '✅': 'チェック',
};

export const isReactionBar=(reaction:string)=>reactionBars.some(value=>value===reaction);
export const reactionColor=(reaction:string)=>isReactionBar(reaction)?'#15803d':undefined;

export const isReactionMoon=(reaction:string)=>reactionMoons.some(value=>value===reaction);
