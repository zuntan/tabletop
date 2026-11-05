import {paletteColors,swatches} from './color-palettes';

/** Generated at read time from the same palette definitions used by the UI. */
export function colorPaletteHelp(){
  return `# Recommended colors (colors)

These are the same choices as the human color picker. Use role-specific recommendations as a starting point when no color is specified. They are suggestions, not rules or instructions to recolor an existing desk.

- User color choices and intent take priority.
- Preserve existing desk colors, classification conventions and visual grouping when applicable.
- Consider the background and transparency. Use colors outside this palette when useful.
- Do not assign universal meanings to colors. Classification depends on how each desk is used.
- Reading this manual does not change desk settings or objects.

## Roles and targets

fill: pale object fills; stroke: outlines and lines; text: textColor; sticker: each sticker item's color.
Each recommended palette has 14 colors. Arrays follow the UI from top row to bottom row, left to right within each row. White and black occupy the leftmost column of the outline and sticker palettes.
all contains the UI's 42 swatches; it does not restrict which colors are allowed.

\`\`\`json
${JSON.stringify({recommended:{fill:paletteColors('fill'),stroke:paletteColors('stroke'),text:paletteColors('text'),sticker:paletteColors('sticker')},all:swatches},null,2)}
\`\`\`
`;
}
