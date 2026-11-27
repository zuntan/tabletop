# Prepared upstream feedback (not submitted)

Base: npm `wireloom@0.7.0`, MIT. Reproduction inputs are in
`../wireframe-comparison/wireloom-review/*.wireloom` with matching names.
The before/after SVGs use the same render ID and default theme.

## Width estimates

Full-width labels are estimated using Latin average width, so Japanese checkbox
labels, buttons and menu labels can overlap or overflow. The Tabletop patch uses
font size for full-width characters, sharing the estimate between layout and
SVG placement. This does not claim exact browser font metrics. Latin-only render
equivalence is covered by tests. The generated patch is reproducible with
`scripts/prepare-wireloom.mjs`, including upstream SHA256 checks.

## Explicit body-text wrapping

`wrapping.wireloom` and `wrapping.svg` demonstrate the separate extension
`text "..." width=240`. Width is pixels; omitted width preserves single-line
behavior. English word boundaries, grapheme fallback for long words, Japanese
character boundaries and basic punctuation rules use the same shared line list
for layout and SVG. Large headers are outside this extension.

These are local examples for discussion; no Issue, PR, or message was posted.
Propose width-estimation correction first; discuss wrapping as a separate feature
with its own grammar/API decision before submitting either implementation.
