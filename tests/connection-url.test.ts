import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseConnectionUrl } from '../src/connection-url';

const token = '0123456789abcdefghijklmnop';
test('connection URLs extract local ports and fragment tokens without networking', () => {
  assert.deepEqual(parseConnectionUrl(` http://127.0.0.1:4317/#token=${token}&port=4317 `), { host: '127.0.0.1', port: '4317', token });
  assert.deepEqual(parseConnectionUrl(`http://localhost:54321/#port=54321&token=${token}`), { host: 'localhost', port: '54321', token });
  assert.deepEqual(parseConnectionUrl('http://127.0.0.1:4317/'), { host: '127.0.0.1', port: '4317', token: null });
  assert.deepEqual(parseConnectionUrl('http://localhost/'), { host: 'localhost', port: '80', token: null });
  const encoded = 'long-token-with-symbols-+&=/%';
  assert.deepEqual(parseConnectionUrl(`http://localhost:4317/#token=${encodeURIComponent(encoded)}`), { host: 'localhost', port: '4317', token: encoded });
});
test('invalid or ambiguous URLs fail without echoing secrets', () => {
  const invalid = [
    '', '4317', '/#token=abc', 'javascript:alert(1)', 'file:///tmp/desk',
    `https://127.0.0.1:4317/#token=${token}`, `http://example.com:4317/#token=${token}`,
    `http://127.0.0.1.evil.test:4317/#token=${token}`, `http://127.0.0.1:4317/other#token=${token}`,
    `http://user:password@127.0.0.1:4317/#token=${token}`, `http://127.0.0.1:4317/?token=${token}`,
    `http://127.0.0.1:4317/#token=${token}&port=4318`, `http://127.0.0.1:0/#token=${token}`,
    `http://127.0.0.1:65536/#token=${token}`, `http://127.0.0.1:4317/#token=${token}&port=NaN`,
    `http://127.0.0.1:4317/#token=${token}&token=${token}`, `http://127.0.0.1:4317/#port=4317&port=4317`,
    `http://127.0.0.1:4317/#token=${token}&extra=yes`, 'http://127.0.0.1:4317/#token=short',
    `http://127.0.0.1:4317/#token=${token}%20`, 'http://127.0.0.1:4317/#token=',
  ];
  const lanUrl = `http://192.168.1.2:4317/#token=${token}`;
  assert.throws(() => parseConnectionUrl(lanUrl));
  assert.deepEqual(parseConnectionUrl(lanUrl, ['192.168.1.2']), { host: '192.168.1.2', port: '4317', token });
  assert.throws(() => parseConnectionUrl(lanUrl, ['192.168.1.3']));
  for (const value of invalid) {
    assert.throws(() => parseConnectionUrl(value), error => error instanceof Error && !error.message.includes(token));
  }
});
