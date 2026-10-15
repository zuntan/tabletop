import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { WebSocket } from 'ws';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { pairPeer } from './pairing-peer';

for (const configured of [false, true]) {
  test(`MCP connection info ${configured ? 'hides configured tokens' : 'returns the active generated URL'} without a browser`, { timeout: 15_000 }, async () => {
    const listener = createServer(); listener.listen(0, '127.0.0.1'); await once(listener, 'listening');
    const port = (listener.address() as { port: number }).port;
    await new Promise<void>(resolve => listener.close(() => resolve()));
    const fixedToken = 'connection-info-test-fixed-0123456789';
    const env = Object.fromEntries(Object.entries(process.env).filter((pair): pair is [string, string] => pair[1] !== undefined));
    delete env.TABLETOP_TOKEN;
    if (configured) env.TABLETOP_TOKEN = fixedToken;
    env.TABLETOP_PORT = String(port);
    const transport = new StdioClientTransport({ command: process.execPath, args: ['--import', 'tsx', 'src/server.ts'], cwd: process.cwd(), env, stderr: 'pipe' });
    let log = ''; transport.stderr?.on('data', data => { log += data.toString(); });
    const client = new Client({ name: 'connection-info-test', version: '1.0.0' });
    let browser: WebSocket | undefined;
    async function info() {
      const result = await client.callTool({ name: 'desk_connection_info', arguments: {} });
      assert.notEqual(result.isError, true);
      return JSON.parse((result.content as { text: string }[])[0].text);
    }
    try {
      await client.connect(transport);
      const first = await info();
      assert.equal(first.port, port); assert.equal(first.browserConnected, false);
      assert.equal(first.tokenSource, configured ? 'environment' : 'generated');
      assert.equal(first.tokenIncluded, !configured);
      const url = new URL(first.url);
      assert.equal(url.origin, `http://127.0.0.1:${port}`);
      const params = new URLSearchParams(url.hash.slice(1));
      const token = configured ? fixedToken : params.get('token')!;
      if (configured) {
        assert.equal(url.hash, ''); assert.ok(!JSON.stringify(first).includes(fixedToken));
        assert.ok(!log.includes(fixedToken)); assert.match(first.message, /configured TABLETOP_TOKEN/);
      } else {
        assert.match(token, /^[0-9a-f]{64}$/); assert.equal(params.get('port'), String(port));
        assert.match(first.message, /temporary secret/);
      }
      assert.deepEqual(await info(), first);
      assert.equal((await client.callTool({ name: 'desk_summary' })).isError, true);
      for (const path of ['connection-info', 'token', 'mcp']) {
        const response = await fetch(`${url.origin}/${path}`);
        assert.equal(response.status, 404); assert.ok(!(await response.text()).includes(token));
      }
      assert.notEqual((await client.callTool({ name: 'desk_pairing_open', arguments: { confirm: true } })).isError, true);
      browser = (await pairPeer(`${url.origin.replace('http:', 'ws:')}/bridge?token=${encodeURIComponent(token)}`, url.origin)).ws;
      const connected = await info();
      assert.equal(connected.browserConnected, true); assert.equal(connected.url, first.url);
      assert.equal(connected.pairingState, 'paired');
      const secretResult = await client.callTool({ name: 'desk_pairing_info', arguments: {} });
      const { pairing } = JSON.parse((secretResult.content as { text: string }[])[0].text);
      assert.ok(pairing.secret); assert.notEqual(pairing.token, token);
      assert.ok(!log.includes(pairing.secret)); assert.ok(!log.includes(pairing.token));
      assert.ok(!JSON.stringify(connected).includes(pairing.secret));
      const tools = await client.listTools();
      const tool = tools.tools.find(tool => tool.name === 'desk_connection_info');
      assert.equal(tool?.annotations?.readOnlyHint, true);
    } finally {
      browser?.close(); await client.close(); await transport.close();
    }
  });
}
