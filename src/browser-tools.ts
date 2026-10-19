import open from 'open';
import type { ChildProcess } from 'node:child_process';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/** Observe a short launcher failure without waiting for the browser itself to close. */
export function observeBrowserLauncher(child: ChildProcess, graceMs = 1500): Promise<void> {
  if (child.exitCode !== null) return child.exitCode === 0 ? Promise.resolve() : Promise.reject(new Error('Browser launcher failed'));
  if (child.signalCode) return Promise.reject(new Error('Browser launcher terminated'));
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); child.off('exit', exited); child.off('error', failed); };
    const exited = (code: number | null) => { cleanup(); code === 0 ? resolve() : reject(new Error('Browser launcher failed')); };
    const failed = () => { cleanup(); reject(new Error('Browser launcher failed')); };
    const timer = setTimeout(() => { cleanup(); resolve(); }, graceMs);
    child.once('exit', exited); child.once('error', failed);
  });
}
async function launchBrowser(url: string) {
  const child = await open(url, { wait: false });
  await observeBrowserLauncher(child);
}

export type BrowserLaunchState = { url: string; listening: boolean; accepting: boolean; connected: boolean };
export function registerBrowserTools(mcp: McpServer, state: () => BrowserLaunchState,
  launch: (url: string) => Promise<unknown> = launchBrowser) {
  mcp.registerTool('desk_browser_open', {
    description: 'Open this Tabletop server in the OS default browser on the machine running the MCP server; Chrome DevTools is not required. Explicitly requested new/manual pairing only: call desk_pairing_open first (or desk_release for an approved handoff), then this tool. Refuses an active desk or closed acceptance; use desk_pairing_restore for restart recovery. Repeated calls while acceptance is open may create multiple tabs/windows; the user closes them. Does not save/load/close desks or enable LAN. An OS launch request is not proof of browser connection: verify desk_connection_info.browserConnected and retain desk_pairing_info. No URL or application argument is accepted. On failure use desk_connection_info for manual opening.',
    inputSchema: {}, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async () => {
    const current = state();
    const fail = (text: string) => ({ isError: true, content: [{ type: 'text' as const, text }] });
    if (!current.listening) return fail('Tabletop server is not listening; no browser was opened.');
    if (current.connected) return fail('A desk is already connected. Release it only for an approved handoff; no browser was opened.');
    if (!current.accepting) return fail('New/manual pairing acceptance is closed. Follow desk_connection_info; use recovery for an existing pairing. No browser was opened.');
    try {
      await launch(current.url);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ launchRequested: true,
        message: 'Default browser launch requested. Verify desk_connection_info.browserConnected; opening is not a connection guarantee. User controls tab/window closure.' }) }] };
    } catch {
      // Launcher errors can contain the private bootstrap URL. Never echo them.
      return fail('Default browser launch failed. Use desk_connection_info to open manually. Pairing acceptance remains open; no automatic retry.');
    }
  });
}
