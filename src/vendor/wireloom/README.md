# Wireloom renderer

Generated from the exact npm dependency `wireloom@0.7.0` (MIT, Stardock).
Source: https://github.com/StardockCorp/Wireloom

Run `npm run wireloom:prepare` to reproduce `index.js`, its types and license.
The generator checks the upstream distribution SHA256 and expected patch sites.
Build and Pages build run it automatically; `node_modules` is never modified.

The local patch estimates Han, kana, Hangul and full-width punctuation at the
font size rather than the Latin average character width. Both measurement and
SVG positioning use the same estimate. Latin-only SVG output stays unchanged.
This remains a font-independent approximation, not browser font measurement.
Body `text "..." width=240` adds an explicit pixel width (1–100000). The local
wrapping helper preserves English words where possible, breaks long words at
grapheme boundaries, and applies basic Japanese line-start/end punctuation rules.
Measurement, positioning and SVG output share the same line split and height.
No `width` means the upstream single-line behavior; there is no implicit wrapping
based on the Tabletop card rectangle. The large-header layout is excluded.
No upstream Issue or PR has been submitted. Remove these patches when compatible
upstream fixes are available. The source grammar is otherwise unchanged.
