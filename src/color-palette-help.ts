import {paletteColors,swatches} from './color-palettes';

/** Generated at read time from the same palette definitions used by the UI. */
export function colorPaletteHelp(){
  return `# おすすめカラー（colors）

人間の色選択UIと同じ候補です。色の指定がないとき、用途別おすすめを出発点にできます。強制する規則や、既存の机を塗り直す指示ではありません。

- 利用者の色指定・意図を優先してください。
- 既存の配色・分類色・揃え方があれば、その文脈を優先してください。
- 背景や透明度を見て組み合わせを選び、候補外の色も必要に応じて使えます。
- 意味を色へ勝手に固定しないでください。分類の意味は机ごとの使い方に従います。
- この説明書を読むだけでは、机の設定やオブジェクトは変わりません。

## 用途と適用先

fill：塗り（淡い色）、stroke：輪郭・線、text：文字（textColor）、sticker：シールの各要素のcolor。
各おすすめは14色。配列は画面の上段→下段、各段は左→右の順です。輪郭とシールの白・黒は左端に縦並びです。
allはUIの全42色で、利用可能な色をこの一覧へ制限する意味ではありません。

\`\`\`json
${JSON.stringify({recommended:{fill:paletteColors('fill'),stroke:paletteColors('stroke'),text:paletteColors('text'),sticker:paletteColors('sticker')},all:swatches},null,2)}
\`\`\`
`;
}
