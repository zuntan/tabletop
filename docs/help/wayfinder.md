# Wayfinders: follow a route with the camera

Select a wayfinder and press its launch popup to move the view along connected lines. Navigation normally keeps zoom unchanged, centers the destination card and selects it.

## Placement and connections

A wayfinder has four anchors: top, right, bottom and left. Their roles are not fixed. It can attach to one object and connect to one route line. Attachment and line connection may share the same anchor.

AI creates `type:wayfinder`, uses `attachment:{objectId,anchor}` for its target and `attachmentAnchor:top|right|bottom|left` for its own attachment point. Missing attachmentAnchor in existing data means bottom. It follows target movement/resizing; target deletion detaches it in place.

Connect a line to any of the wayfinder's four anchors using `startBinding/endBinding`. Join line segments with `startJunction/endJunction`. Crossing or proximity alone is not a connection. Arrowheads do not restrict travel direction.

## Move and tour

- Move eases in and out and caps travel duration even for long distances.
- Tour follows the route at constant screen speed so the surroundings can be viewed, without the same duration cap.

The mode selected in properties is saved per wayfinder. If the destination is another wayfinder, navigation proceeds to its attached target. An unconnected line end also stops navigation.

At a branch, a small map waits for a direction. Choose a direction to resume; the stop button, Escape or clicking outside the map cancels. If similar line angles make direction buttons overlap, adjust the desk layout.

## Start through AI

First identify the target desk with `desk_connections`.

- `desk_wayfinder_start({deskId,id})`: start from a wayfinder.
- `desk_wayfinder_start({deskId,lineId,from:"start"|"end"})`: start at a line endpoint without a wayfinder. Do not also supply id. Transparent lines work too.
- Optional `mode:"move"|"tour"` affects only this run, not the wayfinder's saved setting.

A `status:started` response does not guarantee arrival. Other reads remain possible during travel. Inspect `desk_camera_get`'s `navigation` for the latest state.

- Status: moving, waiting, completed, cancelled, failed.
- Branch wait: `reason:branch`, location and choices.
- Completion reasons: arrived, line-end, loop.
- Cancellation reasons: human, changed, hidden, superseded, timeout.

This is the tab's latest run state, not saved history or a push notification. Navigation moves human attention, so use it when requested or needed in the conversation. Starting is refused during editing, review, thinking mode or just after scrolling. Do not automatically retry cancelled navigation.

## Cancellation, selection and saving

Human input, desk/route edits, another camera operation or visibility changes can cancel navigation in place. Camera travel is not a document edit and does not change revision or Undo.

The departing wayfinder is deselected. Arrival at a card's center selects that card. At a line end or cancellation, preserve any selection the human made after departure. Pin previous/next navigation also deselects on departure and selects the destination pin.

Attachments and route connections are saved and support copy/Undo. Custom speed and simultaneous animation of other objects are not provided.
