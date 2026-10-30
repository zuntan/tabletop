const families = [
  ['#ffffff', '#e5e7eb', '#9ca3af', '#6b7280', '#374151', '#000000'],
  ['#fee2e2', '#fca5a5', '#f87171', '#ef4444', '#b91c1c', '#7f1d1d'],
  ['#ffedd5', '#fdba74', '#fb923c', '#f97316', '#c2410c', '#7c2d12'],
  ['#fef9c3', '#fde047', '#facc15', '#eab308', '#a16207', '#713f12'],
  ['#dcfce7', '#86efac', '#4ade80', '#22c55e', '#15803d', '#14532d'],
  ['#dbeafe', '#93c5fd', '#60a5fa', '#3b82f6', '#1d4ed8', '#1e3a8a'],
  ['#f3e8ff', '#d8b4fe', '#c084fc', '#a855f7', '#7e22ce', '#581c87'],
];
export const swatches = Array.from({ length: 6 }, (_, shade) => families.map(family => family[shade])).flat();
export const recommendedSwatches = {
  fill: families.flatMap(family=>[family[0],family[1]]),
  stroke: ['#ffffff','#000000',...families.slice(1).flatMap(family=>[family[3],family[4]])],
  text: ['#ffffff','#000000',...families.slice(1).flatMap(family=>[family[4],family[5]])],
  sticker: ['#ffffff','#000000',...families.slice(1).flatMap(family=>[family[2],family[3]])],
};

export type PaletteRole = keyof typeof recommendedSwatches;
/** Same display order for the browser and the AI manual. Never mutate shared definitions. */
export function paletteColors(role:PaletteRole,mode:'recommended'|'all'='recommended'):string[]{
  const colors=mode==='all'?[...swatches]:swatches.filter(color=>recommendedSwatches[role].includes(color));
  if(mode==='recommended'&&(role==='stroke'||role==='sticker')){
    // Seven columns: white starts row one; black starts row two.
    colors.splice(colors.indexOf('#000000'),1);colors.splice(7,0,'#000000');
  }
  return colors;
}
