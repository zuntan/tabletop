import { randomUUID } from 'node:crypto';
import { WebSocket, type RawData } from 'ws';

/** Delivery alone is insufficient: require the peer to stop retries before releasing its slot. */
export function acknowledgeRelease(ws: WebSocket, timeout = 3000, handoffUrl?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = randomUUID();
    const finish = (error?: Error) => {
      clearTimeout(timer); ws.off('message', message); ws.off('close', closed);
      if (error) reject(error); else resolve();
    };
    const closed = () => finish(new Error('Browser closed before release acknowledgement; new pairing was not opened.'));
    const message = (data: RawData) => {
      try {
        const value = JSON.parse(data.toString());
        if (value.type === 'release_ack' && value.id === id) finish();
        if (value.type === 'release_rejected' && value.id === id && typeof value.error === 'string') finish(new Error(value.error));
      } catch { /* Other transport handlers validate application messages. */ }
    };
    const timer = setTimeout(() => finish(new Error('Release acknowledgement timed out; new pairing was not opened. Inspect connection state before retrying.')), timeout);
    ws.on('message', message); ws.once('close', closed);
    ws.send(JSON.stringify({ type: 'release', id, ...(handoffUrl ? { handoffUrl } : {}) }), error => { if (error) finish(error); });
  });
}
