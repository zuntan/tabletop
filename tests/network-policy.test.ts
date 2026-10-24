import {callTestTool} from './mcp-call';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { get } from 'node:http';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('stdio network control requires confirmation; startup and restart remain local-only', async () => {
  const reservation = createServer(); reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
  const port = (reservation.address() as { port: number }).port;
  await new Promise<void>(resolve => reservation.close(() => resolve()));
  const token = 'network-policy-012345678901234567890';
  for (let run = 0; run < 2; run++) {
    const transport = new StdioClientTransport({ command: process.execPath, args: ['--import', 'tsx', 'src/server.ts'], cwd: process.cwd(),
      env: { ...Object.fromEntries(Object.entries(process.env).filter((pair): pair is [string, string] => pair[1] !== undefined)), TABLETOP_PORT: String(port), TABLETOP_TOKEN: token }, stderr: 'pipe' });
    const client = new Client({ name: 'network-policy', version: '1.0.0' });
    try {
      await client.connect(transport);
      const info = await callTestTool(client, { name: 'desk_connection_info', arguments: {} });
      const state = JSON.parse((info.content as { text: string }[])[0].text);
      assert.equal(state.network.lanEnabled, false);
      assert.equal(state.network.bindAddress, '127.0.0.1');
      assert.equal(state.network.listening, true);
      assert.deepEqual(state.lanUrls, []);
      assert.equal(JSON.stringify(info).includes(token), false);
      // Invalid input is rejected by the MCP schema, before an enable callback can run.
      for (const args of [{ enabled: true }, { enabled: true, confirm: false }]) {
        const result = await callTestTool(client, { name: 'desk_network_set', arguments: args });
        assert.equal(result.isError, true);
      }
      const result = await callTestTool(client, { name: 'desk_network_set', arguments: { enabled: false, confirm: true } });
      assert.notEqual(result.isError, true);
      const origin = `http://127.0.0.1:${port}`;
      const response = await fetch(`${origin}/connection-policy`);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('access-control-allow-origin'), null);
      const policy = await response.text();
      assert.deepEqual(JSON.parse(policy), { allowedHosts: ['127.0.0.1', 'localhost'] });
      assert.equal(policy.includes(token), false);
      const rejectedStatus = await new Promise<number | undefined>((resolve, reject) => {
        get(`${origin}/connection-policy`, { headers: { Host: `192.168.1.2:${port}` } }, response => {
          response.resume(); resolve(response.statusCode);
        }).on('error', reject);
      });
      assert.equal(rejectedStatus, 403);
    } finally { await client.close(); await transport.close(); }
  }
});
