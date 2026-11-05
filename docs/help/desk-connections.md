# Opening a desk and connecting AI

Explicitly distinguish an AI-connected desk from a human-only desk. Do not infer this from whether it is the first launch.

- `desk_browser_open({mode:"connected"})`: for an authorized new connection or manual pairing. First open additional pairing with `desk_pairing_open({confirm:true})`. Existing desks stay connected. For recovery, use the privately retained secret record.
- `desk_browser_open({mode:"standalone"})`: opens an empty desk without passing credentials. No pairing window or release is needed. Existing connections remain active.

Use `desk_connections()` to inspect each target's `deskId`, name, colors and connection state. **Every per-desk tool requires deskId, even when there is only one desk.** There is no current desk or inferred fallback. Examples: `desk_summary({deskId})`, `desk_execute({deskId,operations:[...]})`. Resolve conversational references such as “the original desk” from context; ask if ambiguous.

A successful launch request only means it was sent to the OS. An existing `browserConnected:true` does not prove the additional desk connected. Verify it in the connection list and privately retain the record from `desk_pairing_info({deskId})`. Automatically named new desks use the initial UI language (for example, Untitled and Untitled(2)); loaded names and explicitly supplied names remain unchanged.

Standalone desks use browser upload/download. Server Save/Load and server loading through desk links require an authenticated connection. AI cannot operate an unconnected desk. Leave closing standalone desks to the human.

For a manual standalone launch, open the server's `/?connect=off` without credentials. Do not reuse a token-bearing URL.

Human Ctrl+C/Ctrl+V can transfer objects between connected desks. Copy does not register data with the server. Only when the destination's local clipboard marker does not match does it query other tabs through MCP for the same marker. If unavailable, it falls back to ordinary text/image paste. AI copying between desks still uses individual read/edit tools.

The Pages edition is statically served and does not connect to AI or MCP. An open Pages tab is not an operation target in `desk_connections`. Treat it separately; do not open pairing and connect it without authorization.

## If the MCP tools themselves are unavailable

If another Codex, Copilot or other agent already started Tabletop, check for a conflict on default port 4317. Look for `EADDRINUSE` in the MCP startup log before concluding that this is the cause. Operate existing desks from the agent that started their server. For an independent server, set the later MCP process's `TABLETOP_PORT` environment variable to an available port. Runtime port tools cannot help when the MCP tools are unavailable. Do not terminate existing processes or desks without permission. This is distinct from a disconnected browser or multiple desks on one MCP server. See README troubleshooting for missing MCP tools and occupied ports. Startup failures may also prevent reading this Help; README and server stderr provide guidance too.
