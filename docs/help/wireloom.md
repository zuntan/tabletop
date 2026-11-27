# Wireloom UI wireframe cards

Create using `desk_execute` with `type: "wireloom"`, `wireloomSource`, `text`
(title) and box geometry. Update `wireloomSource` to edit. Syntax errors are saved
and remain editable. In the editor, hold the eye button to preview the draft in
the source field; releasing it returns to the source without saving. Use `desk_asset_read` to validate/render to SVG and read the
source plus rendering revision. The rendered diagram is not an interactive UI.

```text
window "Settings":
  panel:
    text "Display name"
    input placeholder="Name"
    checkbox "Show notifications" checked label-right
    text "Review the changes before saving your settings." width=240
  footer:
    button "Cancel"
    button "Save" primary
```

Use indentation and quoted labels. Containers end with a colon. Useful containers
include `panel`, `section "Title"`, `row`, `col` and `list`. Form primitives include
`input`, `combo "Choice"`, `checkbox`, `radio`, `toggle`, `button`, and `text`.
`primary`, `checked`, `label-right`, `bold` and `muted` are flags where supported.
Semantic colors use e.g. `button "Delete" accent=danger` or `accent=success`.
This is Wireloom 0.7.0; consult its version's documentation for other primitives.

Tabletop's local extension `text "..." width=240` wraps ordinary body text at
an explicit pixel width. English keeps words where possible; long words use
grapheme boundaries. Japanese uses character boundaries and basic punctuation
rules. A glyph wider than the requested width can overflow. Not for large headers.
Omit width for the upstream single-line behavior. Card resizing scales the entire
SVG and does not reflow text; change the source width for reflow.

The source is saved, copied, undoable and used by Pages, PNG/PDF and media viewing.
Same-desk Markdown images can reference it with `![alt](tabletop://./CARD_ID)`.
This does not enable Wireloom fenced code blocks inside Markdown.

Older Tabletop builds without the wireloom object kind reject desks containing
these cards. Export SVG to share with those versions. No upstream Issue or PR
has been submitted for the local text-width/wrapping patches.
