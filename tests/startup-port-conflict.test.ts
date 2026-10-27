import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

test('occupied startup port explains missing tools without disturbing the existing server', { timeout: 20_000 }, async () => {
  const existing = createServer((_req, res) => res.end('existing desk'));
  existing.listen(0, '127.0.0.1');
  await once(existing, 'listening');
  const port = (existing.address() as { port: number }).port;
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, TABLETOP_PORT: String(port), TABLETOP_TOKEN: 'test-secret-must-not-be-logged' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stderr = '', stdout = '';
  child.stderr.on('data', chunk => { stderr += chunk; });
  child.stdout.on('data', chunk => { stdout += chunk; });
  const timer = setTimeout(() => child.kill('SIGKILL'), 15_000);
  try {
    const [code] = await once(child, 'exit');
    assert.notEqual(code, 0);
    assert.match(stderr, /EADDRINUSE/);
    assert.ok(stderr.includes(`ポート${port}`));
    assert.match(stderr, /Codex・Copilot/);
    assert.match(stderr, /TABLETOP_PORT/);
    assert.match(stderr, /ツールがない/);
    assert.match(stderr, /勝手に終了しない/);
    assert.equal(stderr.includes('test-secret-must-not-be-logged'), false);
    assert.equal(stdout, '');
    assert.equal(await (await fetch(`http://127.0.0.1:${port}`, { headers: { Connection: 'close' } })).text(), 'existing desk');
  } finally {
    clearTimeout(timer);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await new Promise<void>(resolve => existing.close(() => resolve()));
  }
});
