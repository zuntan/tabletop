/** Deliberately limited to body text with an explicit pixel width. No font dependency. */
export function wrapWireloomText(text:string,width:number,measure:(value:string)=>number):string[] {
  const graphemes=(value:string)=>Array.from(new Intl.Segmenter('en',{granularity:'grapheme'}).segment(value),s=>s.segment);
  const opening=/[（［｛「『【〈《〔“‘(\[{]$/u;
  const closing=/^[、。，．・：；？！ー〜…）］｝」』】〉》〕”’!?,.:;)\]}]/u;
  const result:string[]=[];
  for(const paragraph of text.split('\n')) {
    const units=graphemes(paragraph),tokens:string[]=[];
    let previousLatin=false;
    for(const unit of units) {
      const latin=/^[\p{Script=Latin}\p{Number}_'’-]+$/u.test(unit);
      if(latin&&previousLatin)tokens[tokens.length-1]+=unit;
      else tokens.push(unit);
      previousLatin=latin;
    }
    let line='',lineWidth=0;
    const append=(value:string)=>{line+=value;lineWidth+=measure(value);};
    const push=()=>{result.push(line.trimEnd());line='';lineWidth=0;};
    for(const token of tokens) {
      if(!line&&/^\s+$/u.test(token))continue;
      if(lineWidth+measure(token)<=width){append(token);continue;}
      if(line) {
        // Keep a closing mark with the previous character; don't strand opening marks.
        let carry='';const chars=graphemes(line);
        while(chars.length&&opening.test(chars.at(-1)!))carry=chars.pop()!+carry;
        if(closing.test(token)&&chars.length>1)carry=chars.pop()!+carry;
        line=chars.join('');if(line)push();line=carry;lineWidth=measure(carry);
      }
      if(/^\s+$/u.test(token))continue;
      // An unusually long word falls back to grapheme boundaries, never code units.
      if(lineWidth+measure(token)>width)for(const char of graphemes(token)) {
        if(line&&lineWidth+measure(char)>width&&!closing.test(char)&&!opening.test(line))push();
        append(char);
      } else append(token);
    }
    if(line||!paragraph.trim())push();
  }
  return result.length?result:[''];
}
