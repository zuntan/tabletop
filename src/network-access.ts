import type { Server } from 'node:http';
import { networkInterfaces } from 'node:os';

export function lanAddresses(): string[] {
  return [...new Set(Object.values(networkInterfaces()).flatMap(entries => entries ?? [])
    .filter(entry => entry.family === 'IPv4' && !entry.internal && isPrivateIpv4(entry.address))
    .map(entry => entry.address))].sort();
}

export function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.');
  if (parts.length !== 4 || parts.some(part => !/^(0|[1-9]\d{0,2})$/.test(part) || Number(part) > 255)) return false;
  const [a, b] = parts.map(Number);
  return a === 10 || (a === 172 && b! >= 16 && b! <= 31) || (a === 192 && b === 168);
}

/** One listener, local-only on every process start. Pairing is independent. */
export class NetworkAccess {
  private enabled = false;
  private changing = false;
  constructor(private server: Server, private currentPort: number, private addresses = lanAddresses,
    private bindHost: (host: string) => string = host => host) {}
  get port() { return this.currentPort; }
  get isChanging() { return this.changing; }
  allowsPeer(address: string | undefined) {
    return this.enabled || ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address ?? '');
  }
  hosts(includeDisabled = false) {
    return ['127.0.0.1', 'localhost', ...(this.enabled || includeDisabled ? this.addresses() : [])];
  }
  authority(host: string) { return this.port === 80 ? host : `${host}:${this.port}`; }
  allowsHost(host: string | undefined) {
    return this.hosts().some(value => host === this.authority(value));
  }
  allowsOrigin(origin: string | undefined) {
    return this.hosts().some(host => origin === `http://${this.authority(host)}`) ||
      origin === 'http://127.0.0.1:5173' || origin === 'http://localhost:5173';
  }
  info() {
    return { lanEnabled: this.enabled, bindAddress: this.enabled ? '0.0.0.0' : '127.0.0.1', port: this.port,
      listening: this.server.listening, allowedHosts: this.hosts(), lanAddresses: this.enabled ? this.addresses() : [] };
  }
  async listen() { await this.bind('127.0.0.1'); }
  private bind(host: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const failed = (error: Error) => { this.server.off('listening', ready); reject(error); };
      const ready = () => { this.server.off('error', failed); resolve(); };
      this.server.once('error', failed); this.server.once('listening', ready);
      try { this.server.listen(this.port, this.bindHost(host)); }
      catch (error) {
        this.server.off('error', failed); this.server.off('listening', ready);
        reject(error);
      }
    });
  }
  async setPort(port: number) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
    if (this.changing) throw new Error('Network listener change already in progress; inspect status before retrying.');
    if (port === this.port && this.server.listening) return this.info();
    this.changing = true;
    const previous = this.port;
    try {
      this.server.close();
      this.currentPort = port;
      await this.bind(this.enabled ? '0.0.0.0' : '127.0.0.1');
      return this.info();
    } catch (error) {
      this.currentPort = previous;
      try { await this.bind(this.enabled ? '0.0.0.0' : '127.0.0.1'); }
      catch (rollbackError) {
        throw new AggregateError([error, rollbackError], 'Port change and rollback failed; inspect network status before recovery.');
      }
      throw error;
    } finally { this.changing = false; }
  }
  async setLan(enabled: boolean) {
    if (this.changing) throw new Error('Network listener change already in progress; inspect status before retrying.');
    if (enabled === this.enabled && this.server.listening) return this.info();
    if (enabled && this.addresses().length === 0) throw new Error('No private IPv4 LAN address found; listener remains local-only.');
    this.changing = true;
    const previous = this.enabled;
    try {
      // close() drops the listening handle immediately, not upgraded WebSockets.
      // Do not await its callback: it waits for the paired browser to disconnect.
      this.server.close();
      await this.bind(enabled ? '0.0.0.0' : '127.0.0.1');
      this.enabled = enabled;
      return this.info();
    } catch (error) {
      // A failed transition must not silently change the intended access policy.
      try { await this.bind(previous ? '0.0.0.0' : '127.0.0.1'); }
      catch (rollbackError) {
        this.enabled = false;
        throw new AggregateError([error, rollbackError], 'Listener change and rollback failed; no listener is available. Inspect network status before recovery.');
      }
      throw error;
    } finally { this.changing = false; }
  }
}
