# Wireloom card trial

Branch: `feature/wireloom`. Base: Wireloom 0.7.0, pinned in package-lock.json.

- Toolbar creation and double-click title/source editor match Mermaid: the card redraws after applying changes, with a held eye-button preview in the source field, matching Markdown editing. Previewing never applies the draft or changes the editor size.
- Properties expose title and Wireloom source. Parse failures stay editable and
  undoable. The source is the document; generated SVG is transient.
- `type: "wireloom"`, `wireloomSource` (up to 100000 characters). Same card frame,
  image aspect handling, anchors, stickers, clips and rulers as Mermaid.
- MCP `desk_execute` creates/updates sources; `desk_asset_read` returns the source,
  SVG and revision. Same-desk Markdown image references can target these cards.
- Save/load, copy/paste, PNG/PDF and browser-only Pages share the renderer.
- Format envelope stays at version 1; older Tabletop builds do not recognize the
  new object kind and will reject files containing it. They cannot edit it safely;
  use a current build or export SVG for those consumers. Existing desks still load.

## Local text patch

See [renderer provenance](../src/vendor/wireloom/README.md) and the deterministic
generator `scripts/prepare-wireloom.mjs`. Build checks the source hash and patch
sites; node_modules is not edited. The upstream package and license are retained.

Full-width glyphs use the font-size estimate; Latin text retains upstream metrics.
This is approximate typography rather than exact platform font measurement.

```text
window "Confirmation":
  panel:
    text "Please review your changes before saving this document." width=240
  footer:
    button "Cancel"
    button "Save" primary
```

Explicit `text width=N` wraps ordinary body text in pixels. English prefers word
boundaries, long words fall back to graphemes, Japanese uses character boundaries
and basic punctuation rules. A glyph wider than the requested width may overflow.
No hyphenation or full Japanese typesetting engine. This is not the card width:
resizing the outer card scales the diagram with its aspect ratio intact.
Existing text without width remains single-line. Large headers remain single-line.

## Deferred decisions

Wireloom toolbar icon is provisionally Tabler `layout-dashboard`; Mermaid uses
Tabler `sitemap`, selected by the user.
Six existing Tabler candidates are on the desk for the final choice.
Wireloom fences inside Markdown are not implemented. Upstream feedback for text
width and wrapping is prepared locally only; no Issue or PR has been submitted.
