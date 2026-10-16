import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { Server } from 'node:http';
import { test } from 'node:test';
import { NetworkAccess } from '../src/network-access';

// No sockets are opened: deterministic listener failures without LAN exposure.
class Listener extends EventEmitter {
  listening = false;
  failures: ('sync' | 'async' | null)[] = [];
  binds: string[] = [];
  close() { this.listening = false; return this; }
  listen(_port: number, host: string) {
    this.binds.push(host);
    const failure = this.failures.shift();
    if (failure === 'sync') throw new Error('synchronous bind failure');
    queueMicrotask(() => {
      if (failure === 'async') this.emit('error', new Error('asynchronous bind failure'));
      else { this.listening = true; this.emit('listening'); }
    });
    return this;
  }
}

for (const failure of ['sync', 'async'] as const) {
  test(`failed ${failure} LAN enable restores local listener and cleans handlers`, async () => {
    const listener = new Listener();
    const network = new NetworkAccess(listener as unknown as Server, 4317, () => ['192.168.1.2']);
    await network.listen();
    listener.failures = [failure, null];
    await assert.rejects(network.setLan(true), /bind failure/);
    assert.equal(network.info().lanEnabled, false);
    assert.equal(network.info().listening, true);
    assert.equal(network.allowsHost('192.168.1.2:4317'), false);
    assert.equal(network.isChanging, false);
    assert.equal(listener.listenerCount('error'), 0);
    assert.equal(listener.listenerCount('listening'), 0);
    assert.deepEqual(listener.binds, ['127.0.0.1', '0.0.0.0', '127.0.0.1']);
    await network.setLan(false);
    assert.equal(listener.binds.length, 3);
  });
}

test('failed rollback reports offline, denies LAN, and allows explicit local recovery', async () => {
  const listener = new Listener();
  const network = new NetworkAccess(listener as unknown as Server, 4317, () => ['192.168.1.2']);
  await network.listen();
  await network.setLan(true);
  listener.failures = ['async', 'sync'];
  await assert.rejects(network.setLan(false), /rollback failed/);
  assert.equal(network.info().listening, false);
  assert.equal(network.info().lanEnabled, false);
  assert.equal(network.allowsHost('192.168.1.2:4317'), false);
  assert.equal(network.isChanging, false);
  assert.equal(listener.listenerCount('error'), 0);
  assert.equal(listener.listenerCount('listening'), 0);
  assert.equal((await network.setLan(false)).listening, true);
});
