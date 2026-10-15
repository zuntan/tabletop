// Keep file requests below the existing 24 MB WebSocket payload ceiling.
// Measure UTF-8 bytes, not characters, and leave room for bridge envelopes.
export const MAX_DESK_BRIDGE_BYTES = 20_000_000;
export function checkDeskBridgeSize(value: unknown): void {
  if (new TextEncoder().encode(JSON.stringify(value)).length > MAX_DESK_BRIDGE_BYTES) {
    throw new Error('Desk exceeds the 20 MB MCP transfer limit; use browser Save/Load');
  }
}
