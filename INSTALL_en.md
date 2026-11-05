# Installation and first connection

[日本語](INSTALL.md) · [Tabletop](README_en.md)

These steps install Tabletop on your PC for use through an AI agent. The public browser-only Pages edition needs no installation.

English support is in development for v0.1.1. The stable v0.1.0 tag below predates it; use the development instructions if you are testing the English version.

## 1. Requirements

- Node.js 22.12 or later and npm.
- An AI agent that can run a local stdio MCP server.
- A browser; development mainly uses Chrome.
- Git if cloning; a release ZIP is also suitable.

Install and sign in to your AI agent first. MCP configuration locations and syntax vary by agent. This guide describes how to start Tabletop.

Tabletop runs locally and keeps desk contents in the browser tab. Data sent to or handled by AI follows your agent's own mechanisms.

## 2. Install Tabletop

For a release, download and extract the attached **tabletop-VERSION.zip** from GitHub Releases. It includes the release commit information shown in About. Use the accompanying `.sha256` file to check the ZIP. GitHub's automatically generated “Source code” archive does not contain this extra provenance file.

For Git, clone the repository and select the release tag before installing and building:

```sh
git clone https://github.com/zuntan/tabletop.git
cd tabletop
git checkout v0.1.0
node --version
npm ci
npm run build
```

**To test the English development version**, use `git checkout develop` in place of `git checkout v0.1.0`. This is an unreleased branch, not a v0.1.1 release tag. Keep backups of your desk files.

For a ZIP, run the commands starting at `node --version` inside the extracted `tabletop-VERSION` folder. Run `npm ci` on the target machine; do not copy `node_modules` from another PC or OS.

If PowerShell blocks `npm.ps1`, use `npm.cmd`:

```powershell
npm.cmd ci
npm.cmd run build
```

The build creates the browser UI in `dist`. The server also uses `src` and `node_modules`, so keep the entire installation folder, not just `dist`.

## 3. Register the MCP server

Tabletop uses **stdio MCP**. Let the AI agent start the server; you do not need to run `npm start` in a separate terminal. Do not register `http://127.0.0.1:4317/` as an HTTP MCP endpoint: that is the browser server.

- Working directory: the absolute path to your Tabletop folder.
- Command: `node`.
- Arguments: `--import`, `tsx`, `src/server.ts`.

For a client that supports `cwd` and the `mcpServers` configuration format, add this entry to its existing configuration:

```json
{
  "mcpServers": {
    "tabletop": {
      "command": "node",
      "args": ["--import", "tsx", "src/server.ts"],
      "cwd": "/absolute/path/to/tabletop"
    }
  }
}
```

Replace `cwd` with your installation path, such as `C:/dev/tabletop` on Windows. Backslashes in JSON need escaping. Some agents require extra fields such as `type:stdio`, or use a different configuration format; map these values to the client's fields.

For Linux/macOS clients without a working-directory option, use absolute paths:

```json
{
  "mcpServers": {
    "tabletop": {
      "command": "node",
      "args": [
        "--import",
        "/absolute/path/to/tabletop/node_modules/tsx/dist/loader.mjs",
        "/absolute/path/to/tabletop/src/server.ts"
      ]
    }
  }
}
```

Replace both paths. Do not assume JSON expands `~` or environment variables. On Windows, prefer the `cwd` approach rather than passing a drive-letter path directly to `--import`.

Reload the agent's MCP configuration or restart the agent. If it cannot find `node`, set `command` to the absolute path of the Node.js executable.

## 4. Open a desk and reconnect

### Ask AI to open it

**“Open a Tabletop desk.”**

Your browser opens, or the AI provides a connection URL. Then check the connection with:

**“Create one test card on the connected desk.”**

### Three connection terms

- **Connection token**: a secret used for a new connection. It is normally included in the connection URL, so you do not need to create it yourself. Do not publish that URL.
- **Pairing / recovery information**: associates the browser tab with the AI-side Tabletop server and lets it reconnect to the same tab. The AI retains recovery information privately.
- **Desk ID**: a public marker identifying a paired endpoint. AI tools use it to choose the target desk. It is not a secret.

A desk ID is neither an authentication token nor the identity of a saved file. Opening the same file in another tab gives it another ID; a new pairing can change the ID.

Recovery information is a separate secret from the connection token and is not included in desk saves. Closing or reloading the tab loses its tab-side pairing state and requires a new connection. Keep connection URLs and recovery information out of public chats, repositories and screenshots.

### Match the action to the connection state

- **First connection / disconnected**: ask the AI to connect. For an existing tab, say “Connect to this desk.” After the AI opens pairing, open its connection URL or paste it into the existing desk's Connection tab. The URL cannot connect while acceptance is closed.
- **Waiting for AI to reconnect**: the tab is waiting to restore its pairing. After an MCP restart, ask **“Reconnect to the existing desk.”** The AI restores its retained recovery information and waits for that same tab. You do not need to open a new desk or reload the tab.
- **Connection verification required**: automatic recovery has stopped because the peer could not be verified. First download the desk, then arrange a manual reconnection with the AI. Do the same if recovery information has been lost. Do not close the unsaved tab.

Reconnection restores AI access to the current contents; it is not reloading a saved desk. Check both the browser's connection indicator and the AI's ability to read the target before continuing.

### pi-mcp-adapter: idle shutdown

When pi uses **pi-mcp-adapter**, adapter settings may stop the server after a period without MCP calls. Browser activity is separate from MCP activity, so a desk can enter “Waiting for AI to reconnect” while you are editing. Its contents remain in the tab; editing and download still work.

The development record for pi-mcp-adapter 5.3.0, checked on 2026-10-15, reports a default `lazy` lifecycle and a ten-minute idle timeout. This is a version-specific observation, not a claim about every adapter version. If idle shutdown is acceptable, ask AI to reconnect as described above.

To keep the server alive after first use, the adapter supports adding this field to its existing `mcpServers.tabletop` entry, retaining command, args and other settings:

```json
{
  "lifecycle": "lazy-keep-alive"
}
```

Alternatively, `"idleTimeout": 0` disables idle shutdown. These are **pi-mcp-adapter settings**, not fields to copy into every other agent's configuration. Consult the [adapter's configuration documentation](https://github.com/nicobailon/pi-mcp-adapter/blob/main/docs/configuration.md) for your version and configuration location. Save the desk before reloading settings, and ask AI to reconnect if necessary.

## 5. Save and finish

**There is no autosave. Save before closing or reloading the page.**

File → Save writes to the Tabletop server's filesystem. Download retrieves a file through your browser. Load or Upload opens a saved `.tabletop` file. Undo history is not carried into the saved file.

You can ask AI too:

**“Save this desk to …”**

**“Load the desk saved at …”**

Give the target and path. AI Save/Load uses the filesystem of the machine running the Tabletop server, which may differ from the browser's machine.

Loading replaces the current contents. Save anything you need first. Both the file menu and AI requests can perform these operations.

If the MCP server stops, the open tab can still edit and download. Save first and ask AI to restore the existing connection; do not close or reload an unsaved tab just to reconnect. If the AI lost recovery information, save before reconnecting manually.

## 6. Update

Save all desks and stop the relevant Tabletop MCP server first. For a Git installation, fetch tags and select the published release you want. This example selects v0.1.0; replace it with your intended published tag when updating:

```sh
git fetch --tags
git checkout v0.1.0
npm ci
npm run build
```

Review any local changes before updating. For a ZIP, extract the newer version into a separate folder, install/build there and update the MCP installation paths.

Restart MCP, reload the browser to the new version and restore your saved desks. Avoid continuing with only the server or only the browser updated. Keep the previous desk files as backups.

## Troubleshooting

### No Tabletop tools

Check whether MCP is enabled and whether the folder, node executable and arguments are correct. Read the agent's MCP startup log. A server that cannot start is different from an unconnected browser desk.

### EADDRINUSE

Another Tabletop instance or application is using port 4317. Do not terminate an existing server by guesswork. Continue from the agent that owns it, or set `TABLETOP_PORT` to a free port, such as 4318, for a separate MCP server.

In an `mcpServers` configuration, add this field inside the tabletop entry:

```json
"env": { "TABLETOP_PORT": "4318" }
```

Restart that MCP server and use its newly supplied URL. Multiple desks on one MCP server are different from multiple independent MCP servers.

### Missing or old browser UI

Check that `npm run build` succeeded. Use the server URL supplied by AI rather than opening `index.html` directly. Save any open desk before reloading.

### UI opens but AI does not connect

Ask AI to check whether pairing acceptance is open and whether the URL belongs to the intended MCP server. With multiple agents or servers, check that both sides refer to the same endpoint.

Normal installation does not require changing tokens or LAN settings. By default, the server is exposed only on your PC.

## Optional browser automation

If AI has access to Chrome DevTools or another browser automation tool, it can also inspect and operate the screen. This is optional. Tabletop MCP reads and edits desk data; browser tools inspect or interact with the screen itself.

Check that both tools target the same desk tab. Tabletop pairing and browser-tool connections are separate. Follow the browser tool's own setup instructions.
