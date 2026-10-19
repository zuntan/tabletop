export const shapeNames = {
  rect: '矩形', roundedRect: '角丸矩形', ellipse: '楕円', diamond: 'ひし形',
  parallelogram: '平行四辺形', cylinder: '円柱', document: '書類', cloud: '雲',
} as const;
export type ShapeType = keyof typeof shapeNames;
export const shapeTypes = Object.keys(shapeNames) as ShapeType[];
export const isShapeType = (type: string): type is ShapeType => Object.hasOwn(shapeNames, type);
export const isNewShape = (type: string) => isShapeType(type) && !['rect', 'roundedRect', 'ellipse'].includes(type);
export const shapeApproximation = (type: string) => ['ellipse', 'diamond', 'cloud'].includes(type) ? 'ellipse' : 'rect';

/** One outline plus optional internal detail, in local coordinates. */
export function shapePaths(type: string, w: number, h: number) {
  switch (type) {
    case 'diamond': return { outline: `M${w/2},0 L${w},${h/2} L${w/2},${h} L0,${h/2} Z` };
    case 'parallelogram': return { outline: `M${w*.2},0 H${w} L${w*.8},${h} H0 Z` };
    case 'cylinder': {
      const r = h*.13;
      return { outline: `M0,${r} C0,${-r/3} ${w},${-r/3} ${w},${r} V${h-r} C${w},${h+r/3} 0,${h+r/3} 0,${h-r} Z`,
        detail: `M0,${r} C0,${r*2.33} ${w},${r*2.33} ${w},${r}` };
    }
    case 'document': return { outline: `M0,0 H${w} V${h*.85} C${w*.65},${h*.55} ${w*.35},${h*1.15} 0,${h*.85} Z` };
    case 'cloud': return { outline: `M${w*.18},${h*.78} C${-w*.06},${h*.82} ${-w*.02},${h*.36} ${w*.17},${h*.35} C${w*.1},${h*.02} ${w*.4},${-h*.08} ${w*.49},${h*.17} C${w*.67},${-h*.09} ${w*.9},${h*.1} ${w*.85},${h*.34} C${w*1.08},${h*.36} ${w*1.02},${h*.8} ${w*.83},${h*.79} C${w*.8},${h*1.06} ${w*.55},${h*1.04} ${w*.49},${h*.88} C${w*.35},${h*1.08} ${w*.14},${h*1.01} ${w*.18},${h*.78} Z` };
    default: return null;
  }
}

export function fittedShapeFont(type: string, width: number, height: number, text: string, fontSize: number,
  mode: 'auto' | 'shrink' | undefined, measure: (text: string) => number) {
  if (!mode || !text) return fontSize;
  const lines = text.split('\n'), factor = shapeApproximation(type) === 'ellipse' ? Math.SQRT1_2 : 1;
  const contentWidth = Math.max(1, width * factor - 12), contentHeight = Math.max(1, height * factor - 12);
  const units = Math.max(.01, ...lines.map(measure));
  const fitted = Math.max(1, Math.min(1000, contentWidth / units, contentHeight / (lines.length * 1.25)));
  return mode === 'shrink' ? Math.min(fontSize, fitted) : fitted;
}
