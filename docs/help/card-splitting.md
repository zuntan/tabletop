# Split a long card into meaningful cards

Use this procedure when the human asks to split text for readability. It combines existing card and clip operations; it is not a dedicated UI or an automatic splitting feature.

- Identify the target desk with `desk_connections`. Read the text, formatting and surrounding layout.
- Split by meaning rather than character count. Unless asked to summarize, do not omit content. Add useful headings or context while preserving meaning and order.
- Preserve the original in full, including its position, formatting, stamp, stickers, reactions and line or pin connections.
- Carry basic formatting into the new cards, but do not copy stamps, stickers, reactions or connections to the original. Do not copy those marks onto the clip either.
- Place the new cards in free space without covering the original. For a vertical layout, use equal widths and adjust heights to the text. Check fit with `desk_text_measure`. Choose horizontal dimensions to suit the content.
- Default to vertical: `clipAnchor:top`, `clipOffsetMode:percent`, `clipOffsetPercent:100`. Each card advances by the previous card's height.
- If horizontal is requested, use `clipAnchor:left`, `clipOffsetMode:percent`, `clipOffsetPercent:100`. Each card advances by the previous card's width.
- 100 means percent, not 100px. Set clip membership in text order. Unequal cards align by their corresponding anchors. Do not add storage formats or layout algorithms.
- Use `snap:exact` and a current `expectedRevision` to create a consistent set of cards and `clipMembers`. Respect existing bundle and clear-file membership. Leave the original's membership unchanged even if it is already contained.
- Point at the result and report the number of cards, layout direction and preservation of the original. Ask about unclear references or meanings rather than silently omitting them.

Combining a clip bundle into one card is outside this procedure's agreed scope.
