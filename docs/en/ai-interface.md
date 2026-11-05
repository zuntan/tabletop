# Working with AI on the same desk

[日本語](../ai-interface.md) · [Guide](README.md)

Through a supported AI environment, Tabletop lets AI read the desk, place cards, draw diagrams and adjust layouts. Keep talking in your usual AI chat, using the desk's text, diagrams and arrangement as shared references.

## Connect

Your AI environment needs Tabletop's MCP configuration. MCP is the interface through which AI reads and operates the desk. See [Installation](../../INSTALL_en.md).

Ask **“Open a Tabletop desk.”** The AI may open your browser, or give you a connection URL to open yourself. For an existing tab, paste its URL into Connection on the right after the AI has opened pairing acceptance.

Obtaining connection information alone does not connect a desk. Check both the UI connection indicator and the AI's ability to read it. Connection URLs contain secrets; do not publish them.

## Start small

- “Create a card called Today's tasks.”
- “Arrange the selected cards in a row.”
- “Read this explanation and tell me what is unclear. Don't change it yet.”
- “Connect these two cards with a line.”
- “Put your proposal on a separate card and keep the original.”

Say whether you want discussion or actual edits. You do not need to specify the whole result at once: look at what AI places, adjust it yourself and ask for the next step.

## Explain what “this” means

Select the objects and refer to “the selected cards.” Titles, pin numbers and desk positions also help: “the idea in the upper right,” “the diagram between these cards,” or “the contents of this clip.” If similar items make the target ambiguous, ask AI to point first.

Human edits are not necessarily already known to AI. Ask it to reread the current desk when needed. Writing something on the desk does not automatically submit it as a task.

## Selection and AI pointing

Human selection and AI pointing are separate sets with separate frames. Their colors can be changed in desk settings. Pointing means “this is what I mean”; it need not replace your editing selection. Clear AI pointing removes it when no longer needed.

AI can also move or zoom the shared view. Say “Show me this area” or “Explain without moving my view” to express what you want.

## Multiple desks

One MCP server can connect several desks without closing existing ones. Headers show the name and short desk ID. Distinct names, title colors or wallpapers help tell them apart.

Refer to a name or “the blue desk”; if ambiguous, use the header's ID. AI tools require that ID to choose an endpoint. It is not a saved-file identity and may change after reopening or a new pairing.

Loading the same file into two desks does not synchronize their future edits. Decide how to manage their save paths.

## Thinking on your own

Turn on Thinking mode in the header to stop AI edits, pointing and camera movement. Only the human changes this mode. You can keep editing, talking, letting AI read, and saving. It does not hide content from AI.

Turning the mode off does not replay rejected operations. Ask again for the work you want. Active human text editing or dragging can also temporarily refuse AI changes; finish the operation before continuing.

## Save and undo

Ask “Save this desk” or “Save it under another name.” Specify the destination and whether overwriting is allowed. AI edits share the same Undo history as human edits. Undo a result if needed and save states you want to keep.

Lock protects against accidental human geometry changes; it does not prohibit AI editing. Also state in your request which material AI should leave alone.

**Save before closing or reloading. There is no autosave.** When restarting MCP, consider the open tab and its recovery information first.

## Troubleshooting

- **No Tabletop tools in the AI session**: check MCP configuration, connection and startup logs. An open desk does not mean that agent has the tools.
- **Tools exist but no desk is found**: check the browser connection and desk ID.
- **Port occupied**: another server may be using it. Continue with the owning agent or configure a separate port; do not terminate it by guesswork.
- **Cannot open the browser**: this may be separate from MCP pairing. Try opening the supplied URL manually.
- **Edits refused**: check Thinking mode and active text edits or gestures.

A different agent does not automatically inherit a desk opened by another Codex or Copilot process. Check each agent's MCP server.

If a connection drops, do not immediately reload an unsaved tab. Ask AI to investigate. After an MCP-only restart, the existing tab may be recoverable; see [Installation](../../INSTALL_en.md).

## Without an AI connection

Human editing works without AI. Static Pages omits AI connection controls and uses Upload/Download for desk files.

Read-only sharing with an external AI is a separate feature from normal local pairing. Agree on scope and exposure before using it. AI tool descriptions and catalogs use English independently of the human UI language; user text, names and sources retain their original language.
