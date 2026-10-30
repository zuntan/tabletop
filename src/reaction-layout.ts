export const reactionPlacements=['top-left-right','top-left-down','top-right-left','top-right-down','bottom-left-right','bottom-left-up','bottom-right-left','bottom-right-up'] as const;
export type ReactionPlacement=typeof reactionPlacements[number];
export const defaultReactionPlacement:ReactionPlacement='bottom-right-left';
export const reactionPlacementNames:Record<ReactionPlacement,string>={
 'top-left-right':'左上→','top-left-down':'左上↓','top-right-left':'右上←','top-right-down':'右上↓',
 'bottom-left-right':'左下→','bottom-left-up':'左下↑','bottom-right-left':'右下←','bottom-right-up':'右下↑',
};
/** Coordinates in 24-unit badge space. Wrap away from the object after seven marks. */
export function reactionPositions(width:number,height:number,count:number,placement:ReactionPlacement=defaultReactionPlacement){
 const top=placement.startsWith('top'),left=placement.includes('-left-');
 const horizontal=placement.endsWith('-right')||placement.endsWith('-left');
 return Array.from({length:count},(_,i)=>{
  const along=i%7,band=Math.floor(i/7);
  return horizontal
   ?{x:left?along*28:width-24-along*28,y:top?-32-band*28:height+8+band*28}
   :{x:left?-32-band*28:width+8+band*28,y:top?along*28:height-24-along*28};
 });
}
