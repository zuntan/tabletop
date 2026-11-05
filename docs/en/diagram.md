# Shapes, lines, connections and navigation

[日本語](../diagram.md) · [Guide](README.md)

Put words in shapes and connect them to show relationships. With wayfinders, lines can also become routes to distant places. Selection, movement, text and color follow the [basic operations](authoring.md).

## Words in shapes

Add a shape and double-click to write. Its plain text is centered and moves with it; Properties can edit it too. Shapes suit short labels. Use Markdown cards for paragraphs and lists.

Fill, outline and text colors are independent. A transparent fill can leave just a frame and text.

## Lines and arrows

Add a Line or Arrow from the toolbar. If two eligible objects are selected, it connects them. With one selected, a line extends from that object. Without a selection, both endpoints are free.

Select a line to show its round endpoint handles; drag either to position it. Change endpoint markers later, including arrows and circles, without starting over.

## Attach to a card or shape

Move an endpoint near an eligible object to see its anchors. Release while the intended anchor is highlighted. A bound endpoint follows the target when it moves or resizes; merely looking close is not a binding.

Available anchors depend on object type. Props, for example, cannot be line targets. Move an endpoint away to detach it. Dragging a whole line also detaches its shape bindings. Deleting a target leaves the line endpoint detached in place.

## Join lines

Bring one line endpoint near another and release to join them. This supports bends and branches. Dragging a joined endpoint normally moves every endpoint in that joint. Alt+drag detaches just that endpoint.

**Lines crossing in the middle are not connected.** Endpoints at the same coordinates may also be unjoined. This matters particularly for wayfinder routes.

## Polylines and freehand lines

The dropdown beside Line offers:

- **Connected lines (polyline)**: click successive points. Enter or Escape ends input, retaining segments already committed.
- **Freehand lines**: drag a path and release to simplify it into a small number of straight lines. Fine hand jitter is not preserved in full.

The result uses ordinary editable lines. Adjust endpoints or add more segments afterward. If freehand simplification differs from your intention, Undo and redraw with more pronounced turns.

## Line appearance

Change color, width, solid/dashed/dotted style and endpoint markers. Junction rounding rounds eligible corners between two lines; branches with three or more lines do not round in the same way.

Lines and pin threads can follow zoom or retain fixed screen thickness. This changes their appearance rather than their world positions. Export resolves their appearance at the export scale.

## Follow a route with a wayfinder

Place a wayfinder and connect a route line to one of its four anchors. Its attachment to a card and its line connection are separate; all four directions are usable. Each wayfinder has one route-line connection. Put a wayfinder at each end for travel in both directions. The drawing stays upright.

Select it and press the launch popup. The camera follows joined route lines while retaining zoom. Arrowheads do not restrict travel direction. Move mode eases and caps travel time; Tour uses constant screen speed without that cap. Branches wait for a direction on a small map. A line crossing alone does not create a branch.

Human input can stop travel. Arrival at a card center selects that card. Departure deselects the wayfinder. Navigation changes the view, not desk revision or Undo.

## Follow pins

Pins in a series give places an order. Select a pin and use its previous/next controls to visit neighboring pins. The departing pin is deselected and the destination pin selected. Threads show the series sequence; they are not independent line objects.

## When connections are hard to make

Zoom in and check which endpoint or anchor is highlighted before releasing. Locked or filed material may restrict direct manipulation. If navigation stops early, inspect whether the route is actually joined rather than only overlapping.

Try the [English tutorial](tutorial.md) to see working examples.
