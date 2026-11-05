# Arrange cards with rulers

Rulers are layout containers that can coexist on a desk and support save, copy and Undo. The same rules apply to AI and humans. First identify the target `deskId` with `desk_connections`.

## Data

Use `type:ruler` and `rulerMembers:[{id,side:before|after}]`. Only the ruler stores membership and order. Targets are text cards, eight shape types, images, SVG, Mermaid, web cards and links. Lines, pins, props and containers are excluded. Do not duplicate membership with a clip, another ruler or a clear file. To transfer a card between rulers, remove it from the original members first (the same batch is allowed).

- The rectangle's long dimension defines its layout axis. Derived `rulerAxis` is horizontal/vertical. Equal dimensions retain the previous axis, or horizontal for a new ruler.
- The short dimension is `rulerThickness:24|36|48`, default36. Minimum length is120. Width/height updates normalize the short dimension to that setting.
- `side:before` is left of a vertical ruler or above a horizontal ruler; `after` is right or below. The sides are independent. Align the corresponding outer card edge to the ruler, including a media card's title.
- `rulerMode:free|gap|center`, default free. Free preserves along-axis positions. Gap equalizes outer-edge gaps and allows negative gaps when cards do not fit. Center equalizes center spacing.
- Automatic layout aligns the first leading edge and last trailing edge with the ruler's ends. Center spacing is at least4 world units; overflow is allowed at that minimum. One card aligns at the start; zero cards need no calculation. Zoom does not recalculate layout.
- In free mode, x/y edits still snap the perpendicular position back to the ruler. In automatic modes, edit `rulerMembers` to reorder; coordinate-only edits return to automatic layout.
- Moving the ruler's x/y translates the whole bundle. Axis changes preserve order and side; free mode retains offsets from the start. Cards do not rotate.
- `rulerMaterial:acrylic|bamboo|steel`, default acrylic, affects appearance only. Tick marks are decorative, without numbers or measurement units. There is no hide option.

## Human operations

Add a ruler using the toolbar button beside Clear file. Eligible selected cards go on its right side; without a selection, it starts empty.
Drop a card on a long edge to add it. In free mode, drag along the ruler to move a card; in automatic modes, drag to reorder on its side. Alt+drag removes a card. Remove and reattach to change sides.
Dragging the ruler moves the bundle. The bottom-right resize handle changes its rectangle; commit normalizes dimensions and lays out members. Properties choose material, thickness and mode.

## Bundle management

Members follow array order in one contiguous layer block, with the ruler in front. Layer changes move the whole bundle. Lock applies to the ruler and all members together. Deleting the ruler releases its cards in place. Deleting a member also dissolves the ruler and leaves surviving cards, as with a clip.
Copy the ruler with every member and remap member IDs. UI copying of a selected ruler expands to the whole bundle. Copying a card alone does not copy its membership.

Store the ruler and all its members together in a clear file. The file creation UI expands partial selections to full bundles. While filed, adding/removing members, individual resizing, material, mode, internal order and layer changes are disabled. Dragging only translates the whole clear file. Releasing the file restores ruler controls. Text and color edits remain available.

AI should read `rulerMembers` and replace the whole array with `expectedRevision`. Do not disrupt originals or other memberships without authorization. Reading these instructions does not start an operation.
