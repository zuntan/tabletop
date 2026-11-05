# Basic operations and desk tools

[日本語](../authoring.md) · [Guide](README.md)

Place cards and images, arrange them and add marks while you think. The [English tutorial](tutorial.md) contains real tool examples.

## Look around

Zoom with the wheel. Pan with Space+drag or the middle mouse button.

Fit all at the bottom right shows the whole desk. With a selection, Fit selection shows the selected items at a useful size. Center returns the view to the origin.

The top toolbar, right panel and bottom instructions each have their own collapse control. Hide them for more space and reopen them when needed.

## Place, select and move

Add cards and shapes with the toolbar. Import image files or drop them onto the desk.

Click to select, drag to move, or drag across empty space for a rectangular selection. Shift or Ctrl with a click or rectangle adds to the selection.

When a bottom-right resize handle appears, drag it to resize. Lock, object type and membership in a tool may restrict movement or resizing. Enter exact positions and dimensions in Properties. Bring to front / Send to back changes stacking. Delete removes selected items.

### Keyboard and snapping

Arrow keys move the selection. Shift+arrow resizes a single eligible rectangle. Pins, clips, clear files, rulers and lines are not keyboard-resizable.

With Snap enabled, movement follows the desk's snap interval. Add Alt to bypass snapping temporarily for fine adjustment. Text inputs keep their normal keyboard behavior while editing.

Menu → Desk appearance controls grid appearance, grid spacing and snap divisions. Grid visibility and Snap on/off are separate settings.

## Write

Double-click a card or shape to edit its text in place, or use Properties.

For cards, press **Fit frame to text** below the text input in Properties. It adjusts height to the Markdown content and padding while keeping width and font size. With Snap on, height rounds up to the snap interval. It is unavailable inside Clear Folders or while a cutout is applied.

Follow the editor's instructions to commit. Ctrl+Enter (⌘+Enter on Mac) also commits; Escape cancels this edit. The editor's toggle chooses whether Enter commits or inserts a newline.

Cards support safe Markdown: headings, emphasis, lists, quotes, code and HTTP(S) links. Tables, embedded images and raw HTML are not supported. Text inside shapes is plain text.

If text overflows, enlarge the card, reduce its font or split the content. Enlarging the inline editor alone does not resize the card itself.

## Appearance

Fill, Outline, Text and line-width controls affect selected objects and creation appearance. Merely selecting an object does not change creation defaults. Recommended palettes offer a starting point; Properties provides finer control.

Fill transparency affects background fill only: 0% is opaque and 100% is transparent. It does not fade text, outlines or an image's own pixels.

Menu → Desk appearance controls the desk wallpaper, grid and origin markers. Menu → Language… changes UI language locally. Existing content is never automatically translated.

## Copy and paste

Use Ctrl/⌘+C, X and V to copy, cut and paste selected items; a Paste button is also available. Inside a text editor, these shortcuts act on text.

External text becomes a card; a single HTTP(S) URL becomes a link. Images and SVG can also be pasted. If browser clipboard access is unavailable, try Ctrl/⌘+V.

Objects can be copied to another desk connected to the same MCP server. If the source is closed or disconnected, paste may fall back to text or an image.

## Group material

- **Clip**: bundle cards and move them together. Adjust the attachment corner, overlap and spacing.
- **Clear file**: hold material while preserving its arrangement and move it as a unit. Release the contents before moving them individually.
- **Ruler**: align cards along an edge. Position freely or equalize gaps or centers.

Try a layout before deciding every measurement.

## Add marks

Stamps, stickers and reactions add marks without changing the main text. Decide what they mean: completion, classification, attention or something else. A stamp is a visual mark, not a built-in task-state transition.

The initial sticker choices are a red circle for column 1 and a green star for column 2. Existing stickers are unchanged.

Pins label places or sequences. Members of a series are numbered and share color, shape and other appearance settings. Double-click a pin to edit its own description. Some settings affect the whole series; descriptions and positions belong to individual pins. Pin frames and numbers retain screen size when zooming, so they can remain useful when zoomed out.

See [Shapes and connections](diagram.md) for lines and navigation with pins and wayfinders.

## Undo and save

Use Undo/Redo, Ctrl/⌘+Z and Ctrl/⌘+Shift+Z. Human and AI edits share the same desk history.

**There is no autosave. Save before closing or reloading.**

- **Save**: choose a destination the first time, then save to it again.
- **Save as**: choose another destination and use it for subsequent saves.
- **Download**: retrieve a desk file through your browser; its settings determine the destination.
- **Load / Upload**: open a saved desk file.

Desk files contain content, arrangement, appearance and embedded assets. They do not preserve Undo history or resume the exact current selection and camera position.

Static Pages uses Upload/Download rather than server-side Save/Load. PDF and PNG export the visible composition; keep a `.tabletop` file too if you want to edit it later.

## If an operation is unclear

Select an item from Objects and use Fit selection to find it. If it will not move, check Lock and clip, clear-file or ruler membership. The tutorial demonstrates tools, but your own desk does not have to follow its examples.
